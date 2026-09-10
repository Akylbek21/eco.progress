package kz.eco.signature.verification;

import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.cert.ocsp.BasicOCSPResp;
import org.bouncycastle.cert.ocsp.CertificateID;
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.OCSPReq;
import org.bouncycastle.cert.ocsp.OCSPReqBuilder;
import org.bouncycastle.cert.ocsp.OCSPResp;
import org.bouncycastle.cert.ocsp.RevokedStatus;
import org.bouncycastle.cert.ocsp.SingleResp;
import org.bouncycastle.cert.ocsp.jcajce.JcaCertificateID;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URI;
import java.security.cert.X509Certificate;
import java.util.List;

/** OCSP (Online Certificate Status Protocol) check (module spec item 5). Disabled by default
 *  ({@code eco.signature.ocsp.enabled=false}). Requires the issuer's certificate (to build the
 *  {@code CertificateID}) - if the CMS blob didn't embed it, this reports
 *  {@link CertificateCheckStatus#CHECK_ERROR}, not PASSED. Only an explicit {@code REVOKED}
 *  response blocks signing; GOOD/UNKNOWN/any network or parse failure are non-blocking. */
@Service
public class OcspCheckService {

    private static final Logger log = LoggerFactory.getLogger(OcspCheckService.class);

    private final boolean enabled;
    private final int timeoutMs;

    public OcspCheckService(@Value("${eco.signature.ocsp.enabled:false}") boolean enabled,
                             @Value("${eco.signature.ocsp.timeout-ms:5000}") int timeoutMs) {
        this.enabled = enabled;
        this.timeoutMs = timeoutMs;
    }

    public record Result(CertificateCheckStatus status, String detail, boolean revoked) {
    }

    public Result check(X509Certificate certificate, List<X509Certificate> embeddedChain) {
        if (!enabled) {
            return new Result(CertificateCheckStatus.NOT_CONFIGURED, "Проверка OCSP отключена", false);
        }
        String responderUrl = extractOcspUrl(certificate);
        if (responderUrl == null) {
            return new Result(CertificateCheckStatus.CHECK_ERROR,
                    "В сертификате не указан адрес OCSP-службы", false);
        }
        X509Certificate issuer = findIssuer(certificate, embeddedChain);
        if (issuer == null) {
            return new Result(CertificateCheckStatus.CHECK_ERROR,
                    "Сертификат издателя недоступен для построения OCSP-запроса", false);
        }
        try {
            CertificateID certId = new JcaCertificateID(
                    new JcaDigestCalculatorProviderBuilder().build().get(CertificateID.HASH_SHA1),
                    issuer, certificate.getSerialNumber());
            OCSPReqBuilder reqBuilder = new OCSPReqBuilder();
            reqBuilder.addRequest(certId);
            OCSPReq request = reqBuilder.build();

            byte[] responseBytes = postOcspRequest(responderUrl, request.getEncoded());
            OCSPResp response = new OCSPResp(responseBytes);
            if (response.getStatus() != OCSPResp.SUCCESSFUL) {
                return new Result(CertificateCheckStatus.CHECK_ERROR, "OCSP-служба вернула ошибку: " + response.getStatus(), false);
            }
            BasicOCSPResp basicResp = (BasicOCSPResp) response.getResponseObject();
            for (SingleResp single : basicResp.getResponses()) {
                if (!single.getCertID().equals(certId)) {
                    continue;
                }
                CertificateStatus status = single.getCertStatus();
                if (status == null) {
                    return new Result(CertificateCheckStatus.PASSED, null, false);
                }
                if (status instanceof RevokedStatus) {
                    return new Result(CertificateCheckStatus.FAILED, "Сертификат отозван (OCSP)", true);
                }
                return new Result(CertificateCheckStatus.CHECK_ERROR, "OCSP-статус сертификата неизвестен", false);
            }
            return new Result(CertificateCheckStatus.CHECK_ERROR, "Ответ OCSP не содержит статус запрошенного сертификата", false);
        } catch (Exception e) {
            log.warn("OCSP check failed for {}: {}", responderUrl, e.getMessage());
            return new Result(CertificateCheckStatus.CHECK_ERROR, "Не удалось выполнить OCSP-запрос: " + e.getMessage(), false);
        }
    }

    private byte[] postOcspRequest(String url, byte[] body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        connection.setConnectTimeout(timeoutMs);
        connection.setReadTimeout(timeoutMs);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/ocsp-request");
        connection.setDoOutput(true);
        try (var out = connection.getOutputStream()) {
            out.write(body);
        }
        try (var in = connection.getInputStream()) {
            return in.readAllBytes();
        } finally {
            connection.disconnect();
        }
    }

    private X509Certificate findIssuer(X509Certificate certificate, List<X509Certificate> embeddedChain) {
        if (embeddedChain == null) {
            return null;
        }
        for (X509Certificate candidate : embeddedChain) {
            if (candidate.equals(certificate)) {
                continue;
            }
            if (candidate.getSubjectX500Principal().equals(certificate.getIssuerX500Principal())) {
                return candidate;
            }
        }
        return null;
    }

    private String extractOcspUrl(X509Certificate certificate) {
        try {
            byte[] extensionValue = certificate.getExtensionValue(Extension.authorityInfoAccess.getId());
            if (extensionValue == null) {
                return null;
            }
            var holder = new JcaX509CertificateHolder(certificate);
            var aia = org.bouncycastle.asn1.x509.AuthorityInformationAccess.fromExtensions(holder.getExtensions());
            if (aia == null) {
                return null;
            }
            for (var accessDescription : aia.getAccessDescriptions()) {
                if (accessDescription.getAccessMethod().equals(org.bouncycastle.asn1.x509.AccessDescription.id_ad_ocsp)) {
                    var name = accessDescription.getAccessLocation();
                    if (name.getTagNo() == org.bouncycastle.asn1.x509.GeneralName.uniformResourceIdentifier) {
                        return name.getName().toString();
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract OCSP responder URL: {}", e.getMessage());
        }
        return null;
    }
}
