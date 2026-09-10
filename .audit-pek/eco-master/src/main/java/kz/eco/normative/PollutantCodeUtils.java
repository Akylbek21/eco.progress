package kz.eco.normative;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class PollutantCodeUtils {

    private PollutantCodeUtils() {
    }

    /**
     * Restores leading zero stripped by Excel numeric cells (301 -> 0301).
     */
    public static String normalizePollutantCode(String raw) {
        if (raw == null) {
            return null;
        }
        String code = raw.trim();
        if (code.isEmpty()) {
            return code;
        }
        if (code.matches("\\d{3}")) {
            return "0" + code;
        }
        return code;
    }

    public static boolean codesMatch(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        String normalizedLeft = normalizePollutantCode(left.trim());
        String normalizedRight = normalizePollutantCode(right.trim());
        return normalizedLeft.equalsIgnoreCase(normalizedRight);
    }

    public static List<String> searchCodeVariants(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        Set<String> variants = new LinkedHashSet<>();
        String trimmed = raw.trim();
        variants.add(trimmed);
        String normalized = normalizePollutantCode(trimmed);
        if (normalized != null) {
            variants.add(normalized);
            if (normalized.startsWith("0") && normalized.length() == 4) {
                variants.add(normalized.substring(1));
            }
        }
        return List.copyOf(variants);
    }
}
