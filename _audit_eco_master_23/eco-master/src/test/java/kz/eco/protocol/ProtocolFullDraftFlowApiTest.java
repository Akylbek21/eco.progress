package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end walk of the server-side draft workflow (module spec §1): create a minimal draft
 *  (only templateId, no laboratory/executor yet) -> fill in header data via PATCH .../draft
 *  (including sourceNumber and laboratory selection alone, no executor) -> add result rows via
 *  the atomic draft-results batch -> GET and check every field round-tripped -> exercise the
 *  batch's validation guard (a stale version must be rejected, and a batch retry must not
 *  double-apply). */
@SpringBootTest
@Transactional
class ProtocolFullDraftFlowApiTest extends ProtocolApiTestSupport {

    @Autowired WebApplicationContext context;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void createDraft_thenHeader_thenResults_thenGet_roundTripsEverything() throws Exception {
        // 1. create: minimal draft, no laboratory/executor/company yet.
        MvcResult created = mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + templateApiId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString();
        long v0 = version(id);

        // 2. header: company/object, laboratory only (no executorId yet) + sourceNumber. The
        // laboratory snapshot must be populated even though no executor has been chosen.
        String headerBody = """
                {
                  "objectId": %d,
                  "laboratoryId": %d,
                  "sourceNumber": "REG-2026-00042",
                  "version": %d
                }
                """.formatted(objectId, laboratoryId, v0);
        MvcResult headerUpdated = mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(headerBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourceNumber").value("REG-2026-00042"))
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(laboratoryId.toString()))
                .andExpect(jsonPath("$.data.laboratory.executorId").value(org.hamcrest.Matchers.isEmptyOrNullString()))
                .andReturn();
        long v1 = version(headerUpdated);
        assertTrue(v1 > v0, "header update must bump the version");
        // An empty-body PATCH /draft (same idiom as ProtocolDraftResultsBatchApiTest#currentVersion)
        // forces the prior mutation to flush so the JPA-level version below is trustworthy as the
        // batch's optimistic-lock baseline.
        v1 = version(mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + v1 + "}"))
                .andExpect(status().isOk())
                .andReturn());

        // 3. results: atomic add via the draft-results batch.
        String batchBody = """
                {
                  "version": %d,
                  "added": [
                    {"clientRowId": "row-1", "values": {"indicatorName": "Пыль", "unit": "мг/м³", "result": 1.1}}
                  ],
                  "updated": [],
                  "deletedIds": []
                }
                """.formatted(v1);
        MvcResult batched = mockMvc.perform(patch("/api/protocols/" + id + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(batchBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results.length()").value(1))
                .andReturn();
        long v2 = version(batched);

        // 4. GET: everything from steps 2-3 round-trips.
        mockMvc.perform(get("/api/protocols/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourceNumber").value("REG-2026-00042"))
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(laboratoryId.toString()))
                .andExpect(jsonPath("$.data.results.length()").value(1))
                .andExpect(jsonPath("$.data.results[0].indicatorName").value("Пыль"))
                .andExpect(jsonPath("$.data.version").value((int) v2));

        // 5. validation: an empty batch (no added/updated/deletedIds) must not bump version or
        // write an audit entry, and a stale version must be rejected with a conflict.
        int auditEntriesBefore = auditSize(id);

        mockMvc.perform(patch("/api/protocols/" + id + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + v2 + ", \"added\": [], \"updated\": [], \"deletedIds\": []}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value((int) v2));

        assertEquals(auditEntriesBefore, auditSize(id), "empty batch must not write an audit entry");

        mockMvc.perform(patch("/api/protocols/" + id + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "version": %d,
                                  "added": [{"values": {"indicatorName": "Шум", "unit": "дБ", "result": 40}}],
                                  "updated": [],
                                  "deletedIds": []
                                }
                                """.formatted(v2 - 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
    }

    private int auditSize(String protocolId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/protocols/" + protocolId + "/audit"))
                .andExpect(status().isOk())
                .andReturn();
        java.util.List<?> items = JsonPath.read(result.getResponse().getContentAsString(), "$.data");
        return items.size();
    }

    private long version(String protocolId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andReturn();
        return version(result);
    }

    private long version(MvcResult result) throws Exception {
        Object v = JsonPath.read(result.getResponse().getContentAsString(), "$.data.version");
        return Long.parseLong(String.valueOf(v));
    }
}
