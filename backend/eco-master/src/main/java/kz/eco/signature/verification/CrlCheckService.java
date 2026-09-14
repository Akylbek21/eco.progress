package kz.eco.signature.verification;

import org.bouncycastle.asn1.ASN1InputStream;
import org.bouncycastle.asn1.ASN1OctetString;
import org.bouncycastle.asn1.x509.CRLDistPoint;
import org.bouncycastle.asn1.x509.DistributionPoint;
import org.bouncycastle.asn1.x509.DistributionPointName;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URI;
import java.security.cert.CertificateFactory;
import java.security.cert.X509CRL;
import java.security.cert.X509Certificate;

/** CRL (Certificate Revocation List) check (module spec item 5). Disabled by default
 *  ({@code eco.signature.crl.enabled=false}) - never claims PASSED unless it actually fetched and
 *  parsed a CRL from the certificate's own CRL Distribution Point. A network/parse failure while
 *  enabled is reported as {@link CertificateCheckStatus#CHECK_ERROR}, not a silent pass - only an
 *  actual revoked-serial match blocks signing. */
@Service
public class CrlCheckService {

    private static final Logger log = LoggerFactory.getLogger(CrlCheckService.class);

    private final boolean enabled;
    private final int timeoutMs;

    public CrlCheckService(@Value("${eco.signature.crl.enabled:false}") boolean enabled,
                            @Value("${eco.signature.crl.timeout-ms:5000}") int timeoutMs) {
        this.enabled = enabled;
        this.timeoutMs = timeoutMs;
    }

    public record Result(CertificateCheckStatus status, String detail, boolean revoked) {
    }

    public Result check(X509Certificate certificate) {
        if (!enabled) {
            return new Result(CertificateCheckStatus.NOT_CONFIGURED, "Проверка CRL отключена", false);
        }
        String url = extractCrlUrl(certificate);
        if (url == null) {
            return new Result(CertificateCheckStatus.CHECK_ERROR,
                    "В сертификате не найдена точка распространения CRL", false);
        }
        try {
            X509CRL crl = fetchCrl(url);
            boolean revoked = crl.isRevoked(certificate);
            return revoked
                    ? new Result(CertificateCheckStatus.FAILED, "Сертификат отозван (CRL)", true)
                    : new Result(CertificateCheckStatus.PASSED, null, false);
        } catch (Exception e) {
            log.warn("CRL check failed for {}: {}", url, e.getMessage());
            return new Result(CertificateCheckStatus.CHECK_ERROR, "Не удалось получить/разобрать CRL: " + e.getMessage(), false);
        }
    }

    private X509CRL fetchCrl(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setConnectTimeout(timeoutMs);
        connection.setReadTimeout(timeoutMs);
        connection.setRequestMethod("GET");
        try (var in = connection.getInputStream()) {
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            return (X509CRL) factory.generateCRL(in);
        } finally {
            connection.disconnect();
        }
    }

    private String extractCrlUrl(X509Certificate certificate) {
        try {
            byte[] extensionValue = certificate.getExtensionValue(Extension.cRLDistributionPoints.getId());
            if (extensionValue == null) {
                return null;
            }
            try (ASN1InputStream extIn = new ASN1InputStream(extensionValue)) {
                ASN1OctetString octetString = ASN1OctetString.getInstance(extIn.readObject());
                try (ASN1InputStream octIn = new ASN1InputStream(octetString.getOctets())) {
                    CRLDistPoint distPoint = CRLDistPoint.getInstance(octIn.readObject());
                    for (DistributionPoint dp : distPoint.getDistributionPoints()) {
                        DistributionPointName dpName = dp.getDistributionPoint();
                        if (dpName == null || dpName.getType() != DistributionPointName.FULL_NAME) {
                            continue;
                        }
                        GeneralNames names = GeneralNames.getInstance(dpName.getName());
                        for (GeneralName name : names.getNames()) {
                            if (name.getTagNo() == GeneralName.uniformResourceIdentifier) {
                                return name.getName().toString();
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract CRL distribution point: {}", e.getMessage());
        }
        return null;
    }
}
