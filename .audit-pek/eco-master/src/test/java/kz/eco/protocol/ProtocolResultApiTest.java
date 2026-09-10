package kz.eco.protocol;

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

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Legacy POST/PATCH/DELETE /results endpoints are closed (410 Gone).
 *  Normative-check assertions have been migrated to PATCH /draft-results. */
@SpringBootTest
@Transactional
class ProtocolResultApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

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

    // ---- Legacy endpoints are closed (410 Gone) ------------------------------------------------

    @Test
    void legacyPostResult_returns410() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyPatchResult_returns410() throws Exception {
        mockMvc.perform(patch("/api/protocols/" + protocolId + "/results/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyDeleteResult_returns410() throws Exception {
        mockMvc.perform(delete("/api/protocols/" + protocolId + "/results/1"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    // ---- Normative checks via canonical PATCH /draft-results -----------------------------------

    @Test
    void draftBatch_resultWithinNormative_isAdded() throws Exception {
        long version = ((Number) com.jayway.jsonpath.JsonPath.read(
                mockMvc.perform(get("/api/protocols/" + protocolId)).andReturn().getResponse().getContentAsString(),
                "$.data.version")).longValue();

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draftBatchAddNormalJson(version)))
                .andExpect(status().isOk());

        // Row was persisted
        org.junit.jupiter.api.Assertions.assertFalse(
                resultRepository.findByProtocolIdOrderByRowNumberAsc(Long.parseLong(protocolId)).isEmpty(),
                "result row must be stored after batch add");
    }

    @Test
    void draftBatch_resultAboveNormative_isAdded() throws Exception {
        long version = ((Number) com.jayway.jsonpath.JsonPath.read(
                mockMvc.perform(get("/api/protocols/" + protocolId)).andReturn().getResponse().getContentAsString(),
                "$.data.version")).longValue();

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draftBatchAddExceededJson(version)))
                .andExpect(status().isOk());

        org.junit.jupiter.api.Assertions.assertFalse(
                resultRepository.findByProtocolIdOrderByRowNumberAsc(Long.parseLong(protocolId)).isEmpty(),
                "exceeded result row must be stored after batch add");
    }
}
