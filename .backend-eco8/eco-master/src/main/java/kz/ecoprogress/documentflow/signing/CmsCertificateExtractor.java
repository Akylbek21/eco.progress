package kz.ecoprogress.documentflow.signing;

import kz.eco.common.exception.BadRequestException;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.util.Store;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Collection;

/**
 * Extracts the signer certificate's validity window (notBefore/notAfter) from a CMS blob.
 * kz.eco.signature.SignatureVerificationService/SignatureInfo deliberately don't expose this (they
 * only care whether the signature is cryptographically valid over the document, not the
 * certificate's own validity period) - this module needs the dates separately to distinguish
 * CERTIFICATE_EXPIRED from a generic INVALID_CMS per the ticket's verificationStatus contract.
 * Deliberately does NOT re-verify the signature itself - callers must still call
 * SignatureVerificationService.verifyDocument() for that; this class only reads metadata already
 * embedded in the certificate.
 */
public final class CmsCertificateExtractor {

    private CmsCertificateExtractor() {
    }

    public static CmsCertificateInfo extract(String cmsBase64) {
        try {
            byte[] cmsBytes = Base64.getDecoder().decode(cmsBase64.replaceAll("\\s+", ""));
            CMSSignedData signedData = new CMSSignedData(cmsBytes);
            Collection<SignerInformation> signers = signedData.getSignerInfos().getSigners();
            if (signers.isEmpty()) {
                throw new BadRequestException("Подпись не содержит информации о подписанте");
            }
            SignerInformation signer = signers.iterator().next();
            @SuppressWarnings("unchecked")
            Store<X509CertificateHolder> certStore = signedData.getCertificates();
            Collection<X509CertificateHolder> certs = certStore.getMatches(signer.getSID());
            if (certs.isEmpty()) {
                throw new BadRequestException("Сертификат подписанта не найден в подписи");
            }
            X509CertificateHolder cert = certs.iterator().next();
            return new CmsCertificateInfo(
                    Instant.ofEpochMilli(cert.getNotBefore().getTime()).atZone(ZoneOffset.UTC).toLocalDate(),
                    Instant.ofEpochMilli(cert.getNotAfter().getTime()).atZone(ZoneOffset.UTC).toLocalDate());
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Не удалось прочитать сертификат из подписи CMS: " + e.getMessage());
        }
    }
}
