package kz.eco.signature.verification;

import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.util.Store;

import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Pulls the signer's X.509 certificate (and any other certificates embedded in the CMS blob,
 *  which may include intermediates the signer chose to include) out of a CMS signature, in the
 *  standard {@code java.security.cert.X509Certificate} shape the chain/CRL/OCSP checks need -
 *  independent of {@link kz.eco.signature.SignatureVerificationService}, which only returns
 *  parsed subject fields, not the certificate object itself. */
public final class CmsCertificateChainExtractor {

    private CmsCertificateChainExtractor() {
    }

    public record Extracted(X509Certificate signerCertificate, List<X509Certificate> allEmbeddedCertificates) {
    }

    public static Optional<Extracted> extract(String cmsBase64) {
        try {
            byte[] cmsBytes = Base64.getDecoder().decode(cmsBase64.replaceAll("\\s+", ""));
            CMSSignedData signedData = new CMSSignedData(cmsBytes);
            Collection<SignerInformation> signers = signedData.getSignerInfos().getSigners();
            if (signers.isEmpty()) {
                return Optional.empty();
            }
            SignerInformation signer = signers.iterator().next();

            @SuppressWarnings("unchecked")
            Store<X509CertificateHolder> certStore = signedData.getCertificates();
            Collection<X509CertificateHolder> signerCandidates = certStore.getMatches(signer.getSID());
            if (signerCandidates.isEmpty()) {
                return Optional.empty();
            }

            JcaX509CertificateConverter converter = new JcaX509CertificateConverter();
            X509Certificate signerCert = converter.getCertificate(signerCandidates.iterator().next());

            List<X509Certificate> all = new ArrayList<>();
            for (X509CertificateHolder holder : certStore.getMatches(null)) {
                all.add(converter.getCertificate(holder));
            }
            return Optional.of(new Extracted(signerCert, all));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
