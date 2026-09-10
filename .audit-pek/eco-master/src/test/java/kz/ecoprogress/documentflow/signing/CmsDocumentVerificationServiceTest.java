package kz.ecoprogress.documentflow.signing;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = kz.eco.EcoApplication.class)
class CmsDocumentVerificationServiceTest {

    @Autowired
    private CmsDocumentVerificationService verificationService;

    @Test
    void validSignatureOverExactBytesSucceeds() throws Exception {
        byte[] content = "hello document flow".getBytes(StandardCharsets.UTF_8);
        String cms = TestCmsSigner.signAttached(content);

        CmsDocumentVerificationService.Result result = verificationService.verify(cms, content, DocumentFlowTestFixtures.sha256Hex(content));

        assertEquals(VerificationStatus.VALID, result.status());
        assertEquals("990101300123", result.signatureInfo().serialNumber());
    }

    @Test
    void signatureOverDifferentBytesIsRejected() throws Exception {
        byte[] originalContent = "hello document flow".getBytes(StandardCharsets.UTF_8);
        byte[] tamperedContent = "hello TAMPERED flow".getBytes(StandardCharsets.UTF_8);
        String cms = TestCmsSigner.signAttached(originalContent);

        // Signature is over originalContent but we ask the service to verify it against
        // tamperedContent - must be rejected as INVALID_CMS (attached CMS embeds its own content,
        // so verifyDocument's byte-comparison catches the mismatch), not silently accepted.
        UnprocessableEntityException ex = assertThrows(UnprocessableEntityException.class,
                () -> verificationService.verify(cms, tamperedContent, null));
        assertEquals("INVALID_CMS", ex.getCode());
    }

    @Test
    void storageHashMismatchIsCaughtBeforeSignatureVerification() throws Exception {
        byte[] content = "hello document flow".getBytes(StandardCharsets.UTF_8);
        String cms = TestCmsSigner.signAttached(content);

        UnprocessableEntityException ex = assertThrows(UnprocessableEntityException.class,
                () -> verificationService.verify(cms, content, "0000000000000000000000000000000000000000000000000000000000000000"));
        assertEquals("DOCUMENT_HASH_MISMATCH", ex.getCode());
    }

    @Test
    void expiredCertificateIsReportedAsExpiredNotValid() throws Exception {
        byte[] content = "hello document flow".getBytes(StandardCharsets.UTF_8);
        Date notBefore = new Date(System.currentTimeMillis() - 2 * 86_400_000L);
        Date notAfter = new Date(System.currentTimeMillis() - 86_400_000L); // expired yesterday
        String cms = TestCmsSigner.signAttached(content, "990101300123", notBefore, notAfter);

        CmsDocumentVerificationService.Result result = verificationService.verify(cms, content, null);

        assertEquals(VerificationStatus.EXPIRED_CERTIFICATE, result.status());
    }
}
