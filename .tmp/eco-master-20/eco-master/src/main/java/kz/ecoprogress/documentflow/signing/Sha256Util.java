package kz.ecoprogress.documentflow.signing;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Shared hashing helper: IINs and invitation tokens are NEVER stored raw in this module - only
 *  their SHA-256 hex digest (see SigningAssignment/DocumentFlowSignature javadocs). */
public final class Sha256Util {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Sha256Util() {
    }

    public static String sha256Hex(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String sha256Hex(String text) {
        return sha256Hex(text.getBytes(StandardCharsets.UTF_8));
    }

    /** Normalizes an IIN (strip whitespace) before hashing so equivalent input hashes the same. */
    public static String hashIin(String rawIin) {
        if (rawIin == null || rawIin.isBlank()) {
            return null;
        }
        return sha256Hex(rawIin.trim());
    }

    /** Generates a high-entropy, URL-safe random invitation token. Returned to the caller once
     *  (embedded in the invitation link) and never persisted - only its hash is stored. */
    public static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
