package kz.eco.signature;

import kz.eco.user.User;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
import org.springframework.stereotype.Service;

/**
 * Shared "does this certificate actually belong to the person signing" check, used everywhere a
 * CMS signature is accepted (Protocol, PEK reports, Signature Documents): a cryptographically
 * valid CMS signed by SOMEONE ELSE'S certificate must never be accepted just because it verifies.
 * Compares the certificate's embedded subject serial number (commonly "IIN" + 12 digits for
 * NCA-issued certs) against the current user's own {@link User#getIin()}, after normalizing both
 * (strip a leading "IIN" and every non-digit character) so a raw string mismatch doesn't
 * spuriously reject a legitimately-owned certificate.
 */
@Service
public class EdsSigningPolicyService {

    /** @throws ForbiddenException("...", "CERTIFICATE_OWNER_MISMATCH") when the certificate's IIN
     *  doesn't match the signer's own IIN (including when the signer has none linked). */
    public void requireCertificateOwnedByCurrentUser(SignatureInfo signatureInfo, User signer) {
        String certificateIin = normalizeIin(signatureInfo.serialNumber());
        String signerIin = signer == null ? null : normalizeIin(signer.getIin());
        if (certificateIin == null || certificateIin.isBlank() || !certificateIin.equals(signerIin)) {
            throw new ForbiddenException(
                    "ИИН в сертификате подписи не совпадает с ИИН пользователя", "CERTIFICATE_OWNER_MISMATCH");
        }
    }

    /** Strips a leading "IIN" (case-insensitive) and every non-digit character - NCA-issued
     *  certificates commonly encode the subject serial number as "IIN" + 12 digits. */
    public static String normalizeIin(String raw) {
        if (raw == null) {
            return null;
        }
        String stripped = raw.trim();
        if (stripped.regionMatches(true, 0, "IIN", 0, 3)) {
            stripped = stripped.substring(3);
        }
        return stripped.replaceAll("\\D", "");
    }
}
