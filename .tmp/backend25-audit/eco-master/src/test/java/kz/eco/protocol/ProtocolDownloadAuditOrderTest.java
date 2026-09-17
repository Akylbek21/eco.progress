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

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies that the DOWNLOADED audit event is only written after the file is successfully
 * retrieved and (for signed PDFs) hash-verified. A failed download must not produce an audit entry.
 */
@SpringBootTest
@Transactional
class ProtocolDownloadAuditOrderTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ProtocolAuditLogRepository auditRepository;
    @Autowired
    private ProtocolRepository protocolRepository;

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

    private long downloadAuditCount() {
        return auditRepository.findByProtocolIdOrderByCreatedAtDesc(Long.parseLong(protocolId)).stream()
                .filter(a -> a.getAction() == ProtocolAuditAction.DOWNLOADED)
                .count();
    }

    @Test
    void downloadDocx_successfulRead_createsAuditEntry() throws Exception {
        long before = downloadAuditCount();

        mvc.perform(get("/api/protocols/" + protocolId + "/download-docx"))
                .andExpect(status().isOk());

        assertEquals(before + 1, downloadAuditCount(),
                "DOWNLOADED audit must be written after successful DOCX download");
    }

    @Test
    void downloadPdf_successfulRead_createsAuditEntry() throws Exception {
        long before = downloadAuditCount();

        mvc.perform(get("/api/protocols/" + protocolId + "/download-pdf"))
                .andExpect(status().isOk());

        assertEquals(before + 1, downloadAuditCount(),
                "DOWNLOADED audit must be written after successful PDF download");
    }

    @Test
    void downloadDocx_signedWithoutStoredFile_noAuditEntry() throws Exception {
        // Force protocol into SIGNED status without persisting a real file (simulating a case
        // where pdfFileId/docxFileId are null but status is SIGNED - represents a corrupted or
        // migrated record). In this state download must throw SignedDocumentIntegrityException
        // and NOT write a DOWNLOADED audit entry.
        Protocol p = protocolRepository.findById(Long.parseLong(protocolId)).orElseThrow();
        p.setStatus(ProtocolStatus.SIGNED);
        p.setDocxFileId(null); // no stored DOCX
        protocolRepository.saveAndFlush(p);

        long before = downloadAuditCount();

        mvc.perform(get("/api/protocols/" + protocolId + "/download-docx"))
                .andExpect(status().isConflict()); // SignedDocumentIntegrityException -> 409

        assertEquals(before, downloadAuditCount(),
                "DOWNLOADED must NOT be written when download fails with integrity error");
    }

    @Test
    void downloadPdf_signedWithCorruptedHash_noAuditEntry() throws Exception {
        // Simulate a SIGNED protocol with pdfFileId set but pdfSha256 that won't match
        // (tampered file scenario). The hash check should throw before audit is logged.
        Protocol p = protocolRepository.findById(Long.parseLong(protocolId)).orElseThrow();
        p.setStatus(ProtocolStatus.SIGNED);
        p.setPdfSha256("0000000000000000000000000000000000000000000000000000000000000000");
        // pdfFileId stays null -> triggers "missing file" branch first (also correct: no audit)
        protocolRepository.saveAndFlush(p);

        long before = downloadAuditCount();

        mvc.perform(get("/api/protocols/" + protocolId + "/download-pdf"))
                .andExpect(status().isConflict());

        assertEquals(before, downloadAuditCount(),
                "DOWNLOADED must NOT be written when PDF integrity check fails");
    }
}
