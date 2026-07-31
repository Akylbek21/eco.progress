package kz.ecoprogress.documentflow.signing;

import kz.eco.common.exception.BadRequestException;
import kz.eco.signature.SignatureInfo;
import kz.eco.signature.SignatureVerificationService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

/**
 * Wraps kz.eco.signature.SignatureVerificationService (the existing, tested, cryptographically
 * real CMS/CAdES verification pipeline already used by kz.eco.protocol.ProtocolService.sign()) and
 * adds the two checks that pipeline doesn't do on its own:
 *
 * <ol>
 *   <li>Storage-integrity check: the loaded document bytes must match the version's
 *   already-recorded sha256Hash BEFORE we even attempt signature verification - this catches
 *   storage corruption independently of whether the signature itself is valid
 *   (DOCUMENT_HASH_MISMATCH).</li>
 *   <li>Certificate validity window: SignatureVerificationService/SignatureInfo deliberately don't
 *   check or expose the certificate's notBefore/notAfter (a CAdES signature can be
 *   cryptographically valid even if made with a now-expired certificate) - see
 *   CmsCertificateExtractor. This service checks that window explicitly and reports
 *   CERTIFICATE_EXPIRED as its own status rather than silently calling it VALID.</li>
 * </ol>
 *
 * Certificate REVOCATION is NOT checked - there is no CRL/OCSP integration anywhere in this
 * codebase yet. VerificationStatus.REVOKED_CERTIFICATE is defined for forward compatibility but is
 * never produced by this service; this is a documented known limitation, not an oversight. Per the
 * ticket's explicit requirement ("не устанавливать VALID при недоступной проверке"), this only
 * matters if a future revocation check is skipped/unavailable at verify time - since no such check
 * exists yet, VALID here means "signature + document hash + certificate validity window all
 * checked and passed", not "revocation checked".
 */
@Service
public class CmsDocumentVerificationService {

    private final SignatureVerificationService signatureVerificationService;

    public CmsDocumentVerificationService(SignatureVerificationService signatureVerificationService) {
        this.signatureVerificationService = signatureVerificationService;
    }

    public record Result(SignatureInfo signatureInfo, CmsCertificateInfo certificateInfo,
                          VerificationStatus status) {
    }

    /**
     * @param expectedSha256Hash the document version's stored hash to cross-check the loaded bytes
     *                           against before verifying the signature; pass {@code null} to skip
     *                           this check (e.g. for verify-all, where we trust the bytes we just
     *                           loaded ourselves from the same version).
     */
    public Result verify(String cmsBase64, byte[] documentBytes, String expectedSha256Hash) {
        if (expectedSha256Hash != null) {
            String actualHash = Sha256Util.sha256Hex(documentBytes);
            if (!expectedSha256Hash.equalsIgnoreCase(actualHash)) {
                throw new UnprocessableEntityException(
                        "Загруженный файл документа не совпадает с сохранённым хэшем версии",
                        "DOCUMENT_HASH_MISMATCH");
            }
        }
        SignatureInfo info;
        try {
            info = signatureVerificationService.verifyDocument(cmsBase64, documentBytes);
        } catch (BadRequestException e) {
            throw new UnprocessableEntityException(e.getMessage(), "INVALID_CMS");
        }
        if (!info.verified()) {
            throw new UnprocessableEntityException("Подпись недействительна", "INVALID_CMS");
        }
        CmsCertificateInfo certInfo = CmsCertificateExtractor.extract(cmsBase64);
        LocalDate today = LocalDate.now();
        VerificationStatus status = (certInfo.isExpiredOn(today) || certInfo.isNotYetValidOn(today))
                ? VerificationStatus.EXPIRED_CERTIFICATE
                : VerificationStatus.VALID;
        return new Result(info, certInfo, status);
    }
}
