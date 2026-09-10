package kz.eco.signature.verification;

import org.bouncycastle.tsp.TimeStampToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.util.Base64;

/** RFC 3161 timestamp-token check (module spec item 5: "TSA/timestamp, если используется") -
 *  optional by design, unlike chain/CRL/OCSP: a document may legitimately be signed without a
 *  TSA timestamp, so absence is {@link CertificateCheckStatus#NOT_PROVIDED}, not a failure. When
 *  a token IS supplied, it must actually be a well-formed RFC 3161 token whose message imprint
 *  matches the signed content's hash - a token that doesn't verify structurally, or was made over
 *  different bytes, is FAILED (this does not attempt to validate the TSA's own certificate chain
 *  against a trust root - see {@link CertificateChainValidationService} for that, run separately
 *  if a TSA trust root is ever configured). */
@Service
public class TsaVerificationService {

    private static final Logger log = LoggerFactory.getLogger(TsaVerificationService.class);

    public record Result(CertificateCheckStatus status, String detail) {
    }

    public Result verify(String tsaTimestampBase64, byte[] signedContent) {
        if (tsaTimestampBase64 == null || tsaTimestampBase64.isBlank()) {
            return new Result(CertificateCheckStatus.NOT_PROVIDED, null);
        }
        try {
            byte[] tokenBytes = Base64.getDecoder().decode(tsaTimestampBase64.replaceAll("\\s+", ""));
            TimeStampToken token = new TimeStampToken(new org.bouncycastle.cms.CMSSignedData(tokenBytes));
            byte[] expectedImprint = token.getTimeStampInfo().getMessageImprintDigest();
            String digestAlgOid = token.getTimeStampInfo().getMessageImprintAlgOID().getId();
            String jcaAlgorithm = digestAlgOid.equals("2.16.840.1.101.3.4.2.1") ? "SHA-256" : "SHA-1";
            byte[] actualImprint = MessageDigest.getInstance(jcaAlgorithm).digest(signedContent);
            if (!MessageDigest.isEqual(expectedImprint, actualImprint)) {
                return new Result(CertificateCheckStatus.FAILED, "Штамп времени не соответствует подписанному документу");
            }
            return new Result(CertificateCheckStatus.PASSED, null);
        } catch (Exception e) {
            log.warn("TSA token verification failed: {}", e.getMessage());
            return new Result(CertificateCheckStatus.FAILED, "Не удалось разобрать штамп времени: " + e.getMessage());
        }
    }
}
