package kz.eco.signature.verification;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.cert.CertPathValidator;
import java.security.cert.CertPathValidatorException;
import java.security.cert.CertificateFactory;
import java.security.cert.PKIXParameters;
import java.security.cert.TrustAnchor;
import java.security.cert.X509Certificate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** PKIX chain validation against a configurable trust store of root/intermediate CA certificates
 *  (module spec item 5: "цепочка сертификатов"). No trust store ships with this project (no NCA RK
 *  root/intermediate certs are bundled) - {@code eco.signature.trust-store.path} is empty by
 *  default, so this reports {@link CertificateCheckStatus#NOT_CONFIGURED} until an operator
 *  supplies one, never a false PASSED. */
@Service
public class CertificateChainValidationService {

    private static final Logger log = LoggerFactory.getLogger(CertificateChainValidationService.class);

    private final String trustStorePath;
    private final String trustStorePassword;
    private final String trustStoreType;
    private Set<TrustAnchor> trustAnchors = Set.of();

    public CertificateChainValidationService(
            @Value("${eco.signature.trust-store.path:}") String trustStorePath,
            @Value("${eco.signature.trust-store.password:}") String trustStorePassword,
            @Value("${eco.signature.trust-store.type:PKCS12}") String trustStoreType) {
        this.trustStorePath = trustStorePath;
        this.trustStorePassword = trustStorePassword;
        this.trustStoreType = trustStoreType;
    }

    @PostConstruct
    void loadTrustStore() {
        if (trustStorePath == null || trustStorePath.isBlank()) {
            log.warn("Certificate chain validation: no eco.signature.trust-store.path configured - "
                    + "chain checks will report NOT_CONFIGURED until a trust store is supplied");
            return;
        }
        try (FileInputStream in = new FileInputStream(trustStorePath)) {
            KeyStore keyStore = KeyStore.getInstance(trustStoreType);
            keyStore.load(in, trustStorePassword == null ? null : trustStorePassword.toCharArray());
            Set<TrustAnchor> anchors = new HashSet<>();
            var aliases = keyStore.aliases();
            while (aliases.hasMoreElements()) {
                String alias = aliases.nextElement();
                var cert = keyStore.getCertificate(alias);
                if (cert instanceof X509Certificate x509) {
                    anchors.add(new TrustAnchor(x509, null));
                }
            }
            this.trustAnchors = anchors;
            log.warn("Certificate chain validation: loaded {} trust anchor(s) from {}", anchors.size(), trustStorePath);
        } catch (Exception e) {
            log.warn("Certificate chain validation: failed to load trust store at {} ({}) - "
                    + "chain checks will report NOT_CONFIGURED", trustStorePath, e.getMessage());
            this.trustAnchors = Set.of();
        }
    }

    public CertificateCheckStatus validate(X509Certificate signerCertificate, List<X509Certificate> embeddedChain) {
        return validateWithDetail(signerCertificate, embeddedChain).status();
    }

    public record Result(CertificateCheckStatus status, String detail) {
    }

    public Result validateWithDetail(X509Certificate signerCertificate, List<X509Certificate> embeddedChain) {
        if (trustAnchors.isEmpty()) {
            return new Result(CertificateCheckStatus.NOT_CONFIGURED, "Доверенное хранилище сертификатов не настроено");
        }
        try {
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            List<X509Certificate> pathCerts = embeddedChain != null && embeddedChain.contains(signerCertificate)
                    ? embeddedChain : List.of(signerCertificate);
            var certPath = factory.generateCertPath(pathCerts);

            PKIXParameters params = new PKIXParameters(trustAnchors);
            params.setRevocationEnabled(false); // CRL/OCSP are handled by dedicated services, not here
            CertPathValidator validator = CertPathValidator.getInstance("PKIX");
            validator.validate(certPath, params);
            return new Result(CertificateCheckStatus.PASSED, null);
        } catch (CertPathValidatorException e) {
            return new Result(CertificateCheckStatus.FAILED, "Цепочка сертификатов не проходит проверку: " + e.getMessage());
        } catch (Exception e) {
            return new Result(CertificateCheckStatus.CHECK_ERROR, "Не удалось проверить цепочку сертификатов: " + e.getMessage());
        }
    }
}
