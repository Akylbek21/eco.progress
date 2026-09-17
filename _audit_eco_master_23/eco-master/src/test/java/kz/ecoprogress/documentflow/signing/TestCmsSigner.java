package kz.ecoprogress.documentflow.signing;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.cms.CMSProcessableByteArray;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.CMSSignedDataGenerator;
import org.bouncycastle.cms.jcajce.JcaSignerInfoGeneratorBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Date;

/**
 * Equivalent of kz.eco.protocol.TestCmsSigner (package-private there, so copied rather than
 * reused directly across packages) - produces a real, cryptographically valid, attached CMS
 * SignedData blob signed with a freshly generated self-signed certificate, without needing
 * NCALayer or a real CA. Extended with a configurable certificate validity window so tests can
 * exercise CmsDocumentVerificationService's CERTIFICATE_EXPIRED path.
 */
public final class TestCmsSigner {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private TestCmsSigner() {
    }

    public static String signAttached(byte[] content) throws Exception {
        return signAttached(content, "990101300123",
                new Date(System.currentTimeMillis() - 86_400_000L),
                new Date(System.currentTimeMillis() + 86_400_000L));
    }

    public static String signAttached(byte[] content, String iin) throws Exception {
        return signAttached(content, iin,
                new Date(System.currentTimeMillis() - 86_400_000L),
                new Date(System.currentTimeMillis() + 86_400_000L));
    }

    public static String signAttached(byte[] content, String iin, Date notBefore, Date notAfter) throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        KeyPair keyPair = kpg.generateKeyPair();

        X500Name subject = new X500Name("CN=Test Signer,O=EcoProgress Test,SERIALNUMBER=" + iin);
        BigInteger serial = BigInteger.valueOf(System.nanoTime());
        JcaX509v3CertificateBuilder certBuilder = new JcaX509v3CertificateBuilder(
                subject, serial, notBefore, notAfter, subject, keyPair.getPublic());
        ContentSigner contentSigner = new JcaContentSignerBuilder("SHA256withRSA")
                .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                .build(keyPair.getPrivate());
        X509CertificateHolder certHolder = certBuilder.build(contentSigner);
        X509Certificate cert = new JcaX509CertificateConverter()
                .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                .getCertificate(certHolder);

        CMSSignedDataGenerator generator = new CMSSignedDataGenerator();
        generator.addSignerInfoGenerator(new JcaSignerInfoGeneratorBuilder(
                new JcaDigestCalculatorProviderBuilder().setProvider(BouncyCastleProvider.PROVIDER_NAME).build())
                .build(contentSigner, cert));
        generator.addCertificate(certHolder);

        CMSSignedData signedData = generator.generate(new CMSProcessableByteArray(content), true);
        return Base64.getEncoder().encodeToString(signedData.getEncoded());
    }
}
