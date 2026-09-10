package kz.eco.protocol;

public enum ComparisonType {
    LESS_OR_EQUAL,
    GREATER_OR_EQUAL,
    RANGE,
    BETWEEN,
    EQUAL,
    /** Normative requires the indicator's absence (e.g. "Отсутствие" for pathogens/coliforms). */
    ABSENT,
    INFO;

    public static ComparisonType fromApi(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim().toUpperCase();
        if ("BETWEEN".equals(value)) {
            return RANGE;
        }
        return ComparisonType.valueOf(value);
    }
}
