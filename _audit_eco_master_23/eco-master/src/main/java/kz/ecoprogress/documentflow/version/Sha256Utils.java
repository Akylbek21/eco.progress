package kz.ecoprogress.documentflow.version;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Mirrors kz.eco.protocol.ProtocolService#sha256Hex - SHA-256 is JDK-guaranteed
 *  (java.security.MessageDigest javadoc), so NoSuchAlgorithmException here is unreachable. */
public final class Sha256Utils {

    private Sha256Utils() {
    }

    public static String sha256Hex(byte[] data) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 недоступен", e);
        }
    }
}
