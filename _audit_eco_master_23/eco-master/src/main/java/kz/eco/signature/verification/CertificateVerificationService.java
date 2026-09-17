package kz.eco.signature.verification;

import org.springframework.stereotype.Service;

import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Optional;

/** Orchestrates the four certificate-hardening checks (module spec item 5: chain/CRL/OCSP/TSA)
 *  for a single CMS signature submission. Fail-open by design: only a definitive, positive
 *  revocation result (CRL or OCSP) sets {@code revoked=true} and is meant to block signing -
 *  everything else (NOT_CONFIGURED because nothing is set up yet, or CHECK_ERROR because a
 *  configured check couldn't complete) is recorded honestly on the signature row but does not by
 *  itself reject the signature. */
@Service
public class CertificateVerificationService {

    private final CertificateChainValidationService chainService;
    private final CrlCheckService crlService;
    private final OcspCheckService ocspService;
    private final TsaVerificationService tsaService;

    public CertificateVerificationService(CertificateChainValidationService chainService,
                                           CrlCheckService crlService,
                                           OcspCheckService ocspService,
                                           TsaVerificationService tsaService) {
        this.chainService = chainService;
        this.crlService = crlService;
        this.ocspService = ocspService;
        this.tsaService = tsaService;
    }

    public CertificateVerificationResult verify(String cmsBase64, byte[] signedContent, String tsaTimestampBase64) {
        Optional<CmsCertificateChainExtractor.Extracted> extracted = CmsCertificateChainExtractor.extract(cmsBase64);
        if (extracted.isEmpty()) {
            String detail = "Не удалось извлечь сертификат подписанта из CMS";
            return new CertificateVerificationResult(
                    CertificateCheckStatus.CHECK_ERROR, detail,
                    CertificateCheckStatus.CHECK_ERROR, detail,
                    CertificateCheckStatus.CHECK_ERROR, detail,
                    tsaTimestampBase64 == null || tsaTimestampBase64.isBlank()
                            ? CertificateCheckStatus.NOT_PROVIDED : CertificateCheckStatus.CHECK_ERROR,
                    tsaTimestampBase64 == null || tsaTimestampBase64.isBlank() ? null : detail,
                    false, null);
        }

        X509Certificate signer = extracted.get().signerCertificate();
        List<X509Certificate> chain = extracted.get().allEmbeddedCertificates();

        CertificateChainValidationService.Result chainResult = chainService.validateWithDetail(signer, chain);
        CrlCheckService.Result crlResult = crlService.check(signer);
        OcspCheckService.Result ocspResult = ocspService.check(signer, chain);
        TsaVerificationService.Result tsaResult = tsaService.verify(tsaTimestampBase64, signedContent);

        boolean revoked = crlResult.revoked() || ocspResult.revoked();
        String revocationDetail = crlResult.revoked() ? crlResult.detail() : ocspResult.revoked() ? ocspResult.detail() : null;

        return new CertificateVerificationResult(
                chainResult.status(), chainResult.detail(),
                crlResult.status(), crlResult.detail(),
                ocspResult.status(), ocspResult.detail(),
                tsaResult.status(), tsaResult.detail(),
                revoked, revocationDetail);
    }
}
