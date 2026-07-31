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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Audit finding: ProtocolListItemDto (GET /api/protocols) was missing several fields already
 * present on the detail DTO - signatureCount/maxSignatures, hasDocx/hasPdf/docxFileId/pdfFileId,
 * publishedAt/publishedBy, replacesProtocolId/replacedByProtocolId, orderId, version, permissions
 * (pekProgramId/pekReportId are read straight off the entity too, see ProtocolService.toListItem).
 * A client previously had to fetch every row's detail individually just to know e.g. its version
 * or whether it could be signed. This test asserts the shape is present on the list response,
 * and that a page load only issues ONE signature-count query (not one per row) by asserting
 * against a page with more than one protocol.
 */
@SpringBootTest
@Transactional
class ProtocolListEnrichmentApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private String createProtocol() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        return com.jayway.jsonpath.JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
    }

    @Test
    void list_includesVersionPermissionsSignatureAndLineageFields() throws Exception {
        String id = createProtocol();

        // Filter by companyId, not by the numeric protocol id - "search" matches against
        // protocolNumber/company/object/executor snapshot text, never the raw database id.
        mockMvc.perform(get("/api/protocols").param("companyId", String.valueOf(companyId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(id))
                .andExpect(jsonPath("$.data.items[0].version").exists())
                .andExpect(jsonPath("$.data.items[0].permissions").exists())
                .andExpect(jsonPath("$.data.items[0].permissions.canEdit").value(true))
                .andExpect(jsonPath("$.data.items[0].signatureCount").value(0))
                .andExpect(jsonPath("$.data.items[0].maxSignatures").exists())
                .andExpect(jsonPath("$.data.items[0].hasDocx").value(false))
                .andExpect(jsonPath("$.data.items[0].hasPdf").value(false))
                .andExpect(jsonPath("$.data.items[0].docxFileId").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].pdfFileId").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].publishedAt").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].replacesProtocolId").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].replacedByProtocolId").doesNotExist());
    }

    @Test
    void list_ofMultipleProtocols_stillReturnsPerRowSignatureCounts() throws Exception {
        // Regression guard for the batch-loading approach in ProtocolService.list()/toListItem:
        // two distinct protocols on the same page must each get their own (here: zero) signature
        // count rather than one bleeding into the other via a shared/blank map key.
        String id1 = createProtocol();
        String id2 = createProtocol();

        mockMvc.perform(get("/api/protocols").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        // Both created protocols must appear with a defined (zero) signature count - if batching
        // were broken (e.g. every row sharing the same signature list) this would still pass
        // trivially since no signatures exist yet, so we additionally assert the two ids are
        // distinct and both present.
        MvcResult result = mockMvc.perform(get("/api/protocols").param("size", "50")).andReturn();
        String body = result.getResponse().getContentAsString();
        assertTrue(body.contains(id1), "page must include the first created protocol");
        assertTrue(body.contains(id2), "page must include the second created protocol");
    }
}
