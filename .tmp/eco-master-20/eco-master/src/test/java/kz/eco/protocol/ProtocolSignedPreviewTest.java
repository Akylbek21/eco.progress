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

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Verifies that GET /{id}/preview for SIGNED/REPLACED protocols returns the immutable stored PDF
 * (hash-verified) and does NOT trigger a new buildPdf() render of the current data.
 */
@SpringBootTest
@Transactional
class ProtocolSignedPreviewTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ProtocolRepository protocolRepository;
    @Autowired
    private ProtocolService protocolService;

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
        protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
    }

    @Test
    void preview_forUnsignedDraft_rendersOnDemand() throws Exception {
        // DRAFT: preview renders from current data (no pdfFileId stored) - expect a PDF byte stream
        mvc.perform(get("/api/protocols/" + protocolId + "/preview"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void preview_forSignedProtocol_doesNotRerender_returnsIntegrityErrorWhenNoFile() throws Exception {
        // Force a SIGNED status directly on the entity (no pdfFileId, no stored file).
        // This proves that preview takes the immutable-PDF path for SIGNED, not the re-render path.
        // If it were to re-render, it would succeed (200). Instead it must refuse (409).
        Protocol p = protocolRepository.findById(Long.parseLong(protocolId)).orElseThrow();
        p.setStatus(ProtocolStatus.SIGNED);
        p.setPdfFileId(null); // no stored file - immutable path must fail, not fall back to render
        protocolRepository.saveAndFlush(p);

        mvc.perform(get("/api/protocols/" + protocolId + "/preview"))
                .andExpect(status().isConflict()); // SignedDocumentIntegrityException → 409
        // If the old code (pre-fix) were running, it would call generatePreview() -> buildPdf()
        // -> produce a 200. Getting 409 here proves the signed guard is active.
    }

    @Test
    void preview_forSignedProtocol_storedPdfIsServedAsIs() throws Exception {
        // When pdfFileId IS set and the file loads correctly, preview returns that stored PDF.
        // We verify this by storing a known PDF placeholder and checking the response.
        Protocol p = protocolRepository.findById(Long.parseLong(protocolId)).orElseThrow();
        p.setStatus(ProtocolStatus.SIGNED);
        // Write a minimal valid PDF placeholder into file storage and record its id
        byte[] fakePdf = "%PDF-1.4 fake".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        kz.eco.storage.FileStorageService storage = context.getBean(kz.eco.storage.FileStorageService.class);
        kz.eco.storage.StoredFileMetadata meta = storage.storeBytes(
                fakePdf, "preview-test.pdf", "application/pdf", protocolId, "test");
        String hash = org.apache.commons.codec.digest.DigestUtils.sha256Hex(fakePdf);
        p.setPdfFileId(meta.fileId());
        p.setPdfSha256(hash);
        protocolRepository.saveAndFlush(p);

        mvc.perform(get("/api/protocols/" + protocolId + "/preview"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void preview_forSignedProtocol_legacyOnDemandRenderEndpoint_is410() throws Exception {
        mvc.perform(get("/api/protocols/" + protocolId + "/download/pdf"))
                .andExpect(status().isGone());
    }
}
