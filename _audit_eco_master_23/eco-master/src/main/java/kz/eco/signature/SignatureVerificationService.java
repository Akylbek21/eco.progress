package kz.eco.signature;

import kz.eco.common.exception.BadRequestException;
import org.bouncycastle.asn1.x500.RDN;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x500.style.BCStyle;
import org.bouncycastle.asn1.x500.style.IETFUtils;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cms.CMSException;
import org.bouncycastle.cms.CMSProcessable;
import org.bouncycastle.cms.CMSProcessableByteArray;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.cms.SignerInformationVerifier;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.util.Store;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.security.Security;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.HexFormat;

@Service
public class SignatureVerificationService {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    public SignatureInfo verify(String cmsBase64) {
        return verify(decodeBase64(cmsBase64), null);
    }

    /**
     * Verifies a CMS signature and, when {@code expectedDocument} is supplied, additionally
     * confirms the signature actually covers those exact bytes - not just that the CMS blob is
     * structurally valid and cryptographically self-consistent. Handles both attached CMS
     * (content embedded, produced by most NCALayer sign() calls) and detached CMS (content
     * supplied externally): for detached signatures the {@code CMSSignedData} is reconstructed
     * with {@code expectedDocument} as the external content, so a signature made over different
     * bytes simply fails to verify; for attached signatures the embedded content is additionally
     * byte-compared against {@code expectedDocument} so a signature that IS internally valid but
     * wraps some other document is still rejected. Throws {@link BadRequestException} (never
     * returns a "verified=false" result silently) on any parse failure, missing signer/cert, or
     * document mismatch, since a caller gating protocol signing on this must never proceed on an
     * ambiguous result.
     */
    public SignatureInfo verifyDocument(String cmsBase64, byte[] expectedDocument) {
        if (expectedDocument == null || expectedDocument.length == 0) {
            throw new BadRequestException("Нет документа для проверки подписи");
        }
        return verify(decodeBase64(cmsBase64), expectedDocument);
    }

    private SignatureInfo verify(byte[] cmsBytes, byte[] expectedDocument) {
        try {
            SignedDataResult built = buildSignedData(cmsBytes, expectedDocument);
            CMSSignedData signedData = built.signedData();

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
            X500Name subject = cert.getSubject();

            boolean verified;
            try {
                SignerInformationVerifier verifier = new JcaSimpleSignerInfoVerifierBuilder()
                        .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                        .build(cert);
                verified = signer.verify(verifier);
            } catch (Exception e) {
                verified = false;
            }
            if (expectedDocument != null) {
                if (!verified) {
                    throw new BadRequestException("Подпись недействительна или не соответствует документу");
                }
                if (!built.reconstructedFromExternalContent()) {
                    // Genuinely attached CMS: the crypto check above only proves the embedded
                    // content matches its own digest, not that the embedded content is OUR
                    // document - byte-compare it explicitly. (When reconstructedFromExternalContent
                    // is true, buildSignedData() already fed expectedDocument in as the content
                    // being verified against, so this comparison would be redundant.)
                    byte[] embedded = readContent(signedData.getSignedContent());
                    if (!Arrays.equals(sha256(embedded), sha256(expectedDocument))) {
                        throw new BadRequestException("Подписанный документ не совпадает с текущим файлом протокола");
                    }
                }
            }

            return new SignatureInfo(
                    subject.toString(),
                    extractRdn(subject, BCStyle.CN),
                    extractSerialNumber(subject),
                    extractRdn(subject, BCStyle.O),
                    verified
            );
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Ошибка разбора CMS подписи: " + e.getMessage());
        }
    }

    private record SignedDataResult(CMSSignedData signedData, boolean reconstructedFromExternalContent) {
    }

    /** Attached CMS (content embedded) parses directly. Detached CMS (no embedded content) must
     *  be reconstructed with the expected document supplied as external content - otherwise
     *  BouncyCastle has nothing to verify the signature against. The returned flag tells the
     *  caller whether reconstruction happened, so it knows whether an extra byte-comparison
     *  against expectedDocument is still needed (attached case) or already implied by the
     *  reconstruction itself (detached case). */
    private SignedDataResult buildSignedData(byte[] cmsBytes, byte[] expectedDocument) throws CMSException {
        try {
            CMSSignedData attached = new CMSSignedData(cmsBytes);
            if (attached.getSignedContent() != null || expectedDocument == null) {
                return new SignedDataResult(attached, false);
            }
            return new SignedDataResult(new CMSSignedData(new CMSProcessableByteArray(expectedDocument), cmsBytes), true);
        } catch (CMSException e) {
            if (expectedDocument == null) {
                throw e;
            }
            return new SignedDataResult(new CMSSignedData(new CMSProcessableByteArray(expectedDocument), cmsBytes), true);
        }
    }

    private static byte[] readContent(CMSProcessable content) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            content.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new BadRequestException("Не удалось прочитать содержимое подписи: " + e.getMessage());
        }
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String sha256Hex(byte[] data) {
        return HexFormat.of().formatHex(sha256(data));
    }

    private static byte[] decodeBase64(String cmsBase64) {
        if (cmsBase64 == null || cmsBase64.isBlank()) {
            throw new BadRequestException("Подпись не предоставлена");
        }
        try {
            String cleaned = cmsBase64.replaceAll("\\s+", "");
            return Base64.getDecoder().decode(cleaned);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Некорректный формат подписи (не Base64)");
        }
    }

    private String extractRdn(X500Name name, org.bouncycastle.asn1.ASN1ObjectIdentifier oid) {
        RDN[] rdns = name.getRDNs(oid);
        if (rdns.length == 0) return "";
        return IETFUtils.valueToString(rdns[0].getFirst().getValue());
    }

    /**
     * NCA certificates store IIN in SERIALNUMBER, sometimes in OID 1.2.398.3.3.4.1.
     */
    private String extractSerialNumber(X500Name name) {
        String sn = extractRdn(name, BCStyle.SERIALNUMBER);
        if (!sn.isEmpty()) return sn;
        // Fallback to NCA-specific OID for IIN
        try {
            var ncaIinOid = new org.bouncycastle.asn1.ASN1ObjectIdentifier("1.2.398.3.3.4.1");
            return extractRdn(name, ncaIinOid);
        } catch (Exception e) {
            return "";
        }
    }
}
