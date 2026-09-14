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

/**
 * Verifies that all legacy mutation endpoints have been closed (HTTP 410 Gone).
 * Canonical replacements: PATCH /{id}/draft-results for result mutations;
 * GET /{id}/download-docx and GET /{id}/download-pdf for file downloads.
 */
@SpringBootTest
@Transactional
class ProtocolLegacyApiClosureTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private String protocolId;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        MvcResult created = mvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id");
    }

    // ---- Individual result CRUD endpoints (closed) --------------------------------------------

    @Test
    void legacyPostResult_is410() throws Exception {
        mvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyPatchResult_is410() throws Exception {
        mvc.perform(patch("/api/protocols/" + protocolId + "/results/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyDeleteResult_is410() throws Exception {
        mvc.perform(delete("/api/protocols/" + protocolId + "/results/999"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    // ---- Bulk mutation endpoints (closed) -----------------------------------------------------

    @Test
    void legacyBulkDevice_is410() throws Exception {
        mvc.perform(patch("/api/protocols/" + protocolId + "/results/bulk-device")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0,\"resultIds\":[1],\"measurementDeviceId\":1}"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyBulkPlace_is410() throws Exception {
        mvc.perform(patch("/api/protocols/" + protocolId + "/results/bulk-place")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0,\"resultIds\":[1],\"measurementPlace\":\"Точка 1\"}"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyBulkDelete_is410() throws Exception {
        mvc.perform(delete("/api/protocols/" + protocolId + "/results/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0,\"resultIds\":[1]}"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    // ---- Duplicate on-demand download endpoints (closed) ----------------------------------------

    @Test
    void legacyDownloadDocxRendered_is410() throws Exception {
        mvc.perform(get("/api/protocols/" + protocolId + "/download/docx"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    @Test
    void legacyDownloadPdfRendered_is410() throws Exception {
        mvc.perform(get("/api/protocols/" + protocolId + "/download/pdf"))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ENDPOINT_REMOVED"));
    }

    // ---- Canonical endpoints still work --------------------------------------------------------

    @Test
    void canonicalDraftResults_isAccepted() throws Exception {
        long version = ((Number) com.jayway.jsonpath.JsonPath.read(
                mvc.perform(get("/api/protocols/" + protocolId)).andReturn().getResponse().getContentAsString(),
                "$.data.version")).longValue();
        mvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draftBatchAddNormalJson(version)))
                .andExpect(status().isOk());
    }

    @Test
    void canonicalDownloadDocx_isAccepted() throws Exception {
        mvc.perform(get("/api/protocols/" + protocolId + "/download-docx"))
                .andExpect(status().isOk());
    }
}
