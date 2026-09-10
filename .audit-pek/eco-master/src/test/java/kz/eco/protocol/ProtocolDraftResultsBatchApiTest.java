package kz.eco.protocol;

import kz.eco.protocol.dto.ProtocolApiDtos;
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
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Covers the atomic add/update/delete draft-results batch endpoint (module spec item 1):
 *  one version check, one contentVersion/JPA-version bump, no partial writes on error, and
 *  idempotent retries via the shared ProtocolIdempotencyService. */
@SpringBootTest
@Transactional
class ProtocolDraftResultsBatchApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ProtocolService protocolService;

    private MockMvc mockMvc;
    private String protocolId;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id");
    }

    private long addSeedRow() throws Exception {
        long version = protocolService.get(Long.parseLong(protocolId)).version();
        return addResultViaDraftBatch(mockMvc, protocolId, version);
    }

    private long currentVersion() throws Exception {
        return protocolService.get(Long.parseLong(protocolId)).version();
    }

    @Test
    void addUpdateDelete_inOneRequest_appliesAllAtomically() throws Exception {
        long toUpdate = addSeedRow();
        long toDelete = addSeedRow();
        long version = currentVersion();

        String body = """
                {
                  "version": %d,
                  "added": [
                    {"clientRowId": "row-1", "values": {"indicatorName": "Пыль", "unit": "мг/м³", "result": 1.1}}
                  ],
                  "updated": [
                    {"id": %d, "values": {"result": 2.2}}
                  ],
                  "deletedIds": [%d]
                }
                """.formatted(version, toUpdate, toDelete);

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.results.length()").value(2));
    }

    @Test
    void versionIncrementsExactlyOnceForWholeBatch() throws Exception {
        long toUpdate = addSeedRow();
        long before = currentVersion();

        String body = """
                {
                  "version": %d,
                  "added": [
                    {"clientRowId": "row-1", "values": {"indicatorName": "Пыль", "unit": "мг/м³", "result": 1.1}}
                  ],
                  "updated": [
                    {"id": %d, "values": {"result": 3.3}}
                  ],
                  "deletedIds": []
                }
                """.formatted(before, toUpdate);

        MvcResult result = mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        Object after = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.version");
        assertEquals(before + 1, Long.parseLong(String.valueOf(after)));
    }

    @Test
    void staleVersion_returns409WithOptimisticLockCode() throws Exception {
        long version = currentVersion();
        String body = """
                {"version": %d, "added": [], "updated": [], "deletedIds": []}
                """.formatted(version - 1);

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
    }

    @Test
    void invalidResultId_rollsBackWholeBatch() throws Exception {
        long version = currentVersion();
        String body = """
                {
                  "version": %d,
                  "added": [
                    {"clientRowId": "row-1", "values": {"indicatorName": "Пыль", "unit": "мг/м³", "result": 1.1}}
                  ],
                  "updated": [
                    {"id": 999999999, "values": {"result": 3.3}}
                  ],
                  "deletedIds": []
                }
                """.formatted(version);

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().is4xxClientError());

        long afterVersion = currentVersion();
        MvcResult after = mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + afterVersion + "}"))
                .andExpect(status().isOk())
                .andReturn();
        Object results = com.jayway.jsonpath.JsonPath.read(after.getResponse().getContentAsString(), "$.data.results.length()");
        assertEquals(0, Integer.parseInt(String.valueOf(results)));
    }

    @Test
    void repeatedIdempotencyKey_doesNotDuplicateRows() throws Exception {
        long version = currentVersion();
        String body = """
                {
                  "version": %d,
                  "added": [
                    {"clientRowId": "row-1", "values": {"indicatorName": "Пыль", "unit": "мг/м³", "result": 1.1}}
                  ],
                  "updated": [],
                  "deletedIds": []
                }
                """.formatted(version);
        String key = "draft-results-" + java.util.UUID.randomUUID();

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results.length()").value(1));

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results.length()").value(1));
    }

    @Test
    void normativeId_persistsAfterGet() throws Exception {
        Long normativeId = 4242424242L;
        long version = currentVersion();
        String body = """
                {
                  "version": %d,
                  "added": [
                    {"clientRowId": "row-1", "normativeId": %d,
                     "values": {"indicatorName": "Пыль", "unit": "мг/м³", "result": 1.1}}
                  ],
                  "updated": [],
                  "deletedIds": []
                }
                """.formatted(version, normativeId);

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        long afterVersion = currentVersion();
        MvcResult afterGet = mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + afterVersion + "}"))
                .andExpect(status().isOk())
                .andReturn();
        Object storedNormativeId = com.jayway.jsonpath.JsonPath.read(
                afterGet.getResponse().getContentAsString(), "$.data.results[0].normativeId");
        assertEquals(String.valueOf(normativeId), String.valueOf(storedNormativeId));
    }

    @Test
    void emptyDelta_returns200_butDoesNotBumpVersion() throws Exception {
        long before = currentVersion();
        String body = """
                {"version": %d, "added": [], "updated": [], "deletedIds": []}
                """.formatted(before);

        MvcResult result = mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        Object after = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.version");
        assertEquals(before, Long.parseLong(String.valueOf(after)), "a true no-op delta must not bump version");
    }

    /** Module spec: the legacy top-level "results" field must be a hard 400, not silently
     *  ignored - DraftResultsBatchRequest no longer carries @JsonIgnoreProperties(ignoreUnknown). */
    @Test
    void legacyResultsField_returns400() throws Exception {
        long version = currentVersion();
        String body = """
                {"version": %d, "results": [{"indicatorName": "Пыль"}], "added": [], "updated": [], "deletedIds": []}
                """.formatted(version);

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void signedProtocol_rejectsDraftResultsBatch() throws Exception {
        ProtocolApiDtos.ProtocolResponse cancelled = protocolService.cancel(
                Long.parseLong(protocolId), currentVersion(), "Отменено для теста", labUser.getId());

        String body = """
                {"version": %d, "added": [], "updated": [], "deletedIds": []}
                """.formatted(cancelled.version());

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }
}
