package kz.eco.signature.verification;

import kz.ecoprogress.documentflow.signing.TestCmsSigner;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Unit-level coverage for the certificate-hardening framework (module spec item 5) with the
 *  default (disabled) configuration: every check must honestly report NOT_CONFIGURED/NOT_PROVIDED
 *  and never throw or claim PASSED, matching the graceful-fail-open contract. Real
 *  enabled=true HTTP CRL/OCSP calls against a live responder are out of scope for a unit test -
 *  see CertificateChainValidationService/CrlCheckService/OcspCheckService javadocs. */
class CertificateVerificationServiceTest {

    private final CertificateChainValidationService chainService =
            new CertificateChainValidationService("", "", "PKCS12");
    private final CrlCheckService crlService = new CrlCheckService(false, 5000);
    private final OcspCheckService ocspService = new OcspCheckService(false, 5000);
    private final TsaVerificationService tsaService = new TsaVerificationService();
    private final CertificateVerificationService orchestrator =
            new CertificateVerificationService(chainService, crlService, ocspService, tsaService);

    @Test
    void disabledConfig_everyCheckReportsNotConfigured_neverPassed() throws Exception {
        chainService.loadTrustStore();
        byte[] content = "test document body".getBytes(StandardCharsets.UTF_8);
        String cms = TestCmsSigner.signAttached(content, "990101300123");

        CertificateVerificationResult result = orchestrator.verify(cms, content, null);

        assertEquals(CertificateCheckStatus.NOT_CONFIGURED, result.chainStatus());
        assertEquals(CertificateCheckStatus.NOT_CONFIGURED, result.crlStatus());
        assertEquals(CertificateCheckStatus.NOT_CONFIGURED, result.ocspStatus());
        assertEquals(CertificateCheckStatus.NOT_PROVIDED, result.tsaStatus());
        assertFalse(result.revoked());
        assertNull(result.revocationDetail());
    }

    @Test
    void malformedCms_reportsCheckErrorNotPassed_neverThrows() {
        CertificateVerificationResult result = orchestrator.verify(
                java.util.Base64.getEncoder().encodeToString("not a real cms blob".getBytes(StandardCharsets.UTF_8)),
                "irrelevant".getBytes(StandardCharsets.UTF_8), null);

        assertEquals(CertificateCheckStatus.CHECK_ERROR, result.chainStatus());
        assertEquals(CertificateCheckStatus.CHECK_ERROR, result.crlStatus());
        assertEquals(CertificateCheckStatus.CHECK_ERROR, result.ocspStatus());
        assertFalse(result.revoked());
    }

    @Test
    void crlAndOcspDisabled_reportNotConfigured_regardlessOfCertificate() {
        CrlCheckService.Result crlResult = crlService.check(null);
        assertEquals(CertificateCheckStatus.NOT_CONFIGURED, crlResult.status());
        assertFalse(crlResult.revoked());

        OcspCheckService.Result ocspResult = ocspService.check(null, java.util.List.of());
        assertEquals(CertificateCheckStatus.NOT_CONFIGURED, ocspResult.status());
        assertFalse(ocspResult.revoked());
    }

    @Test
    void tsaWithNoToken_reportsNotProvided() {
        TsaVerificationService.Result result = tsaService.verify(null, "content".getBytes(StandardCharsets.UTF_8));
        assertEquals(CertificateCheckStatus.NOT_PROVIDED, result.status());
    }

    @Test
    void tsaWithGarbageToken_reportsFailedNotPassed_neverThrows() {
        TsaVerificationService.Result result = tsaService.verify(
                java.util.Base64.getEncoder().encodeToString("garbage".getBytes(StandardCharsets.UTF_8)),
                "content".getBytes(StandardCharsets.UTF_8));
        assertEquals(CertificateCheckStatus.FAILED, result.status());
    }

    @Test
    void chainValidation_withNoTrustStoreConfigured_reportsNotConfigured() throws Exception {
        chainService.loadTrustStore();
        byte[] content = "another document".getBytes(StandardCharsets.UTF_8);
        String cms = TestCmsSigner.signAttached(content, "990101300123");
        var extracted = CmsCertificateChainExtractor.extract(cms).orElseThrow();

        CertificateChainValidationService.Result result =
                chainService.validateWithDetail(extracted.signerCertificate(), extracted.allEmbeddedCertificates());
        assertEquals(CertificateCheckStatus.NOT_CONFIGURED, result.status());
    }
}
