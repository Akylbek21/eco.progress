package kz.ecoprogress.documentflow.signing;

import java.time.LocalDate;

/** Certificate validity-window facts that kz.eco.signature.SignatureInfo does not expose (that
 *  record only carries subject/CN/serial/organization/verified - no notBefore/notAfter). Extracted
 *  separately by CmsCertificateExtractor from the same CMS blob. */
public record CmsCertificateInfo(LocalDate notBefore, LocalDate notAfter) {

    public boolean isExpiredOn(LocalDate date) {
        return notAfter != null && date.isAfter(notAfter);
    }

    public boolean isNotYetValidOn(LocalDate date) {
        return notBefore != null && date.isBefore(notBefore);
    }
}
