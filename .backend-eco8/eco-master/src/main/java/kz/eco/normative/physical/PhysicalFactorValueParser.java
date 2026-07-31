package kz.eco.normative.physical;

import kz.eco.protocol.ComparisonType;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PhysicalFactorValueParser {

    private static final Pattern RANGE_PATTERN = Pattern.compile(
            "(-?\\d+(?:[.,]\\d+)?)\\s*[-–—]\\s*(-?\\d+(?:[.,]\\d+)?)");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("-?\\d+(?:[.,]\\d+)?");

    private PhysicalFactorValueParser() {
    }

    public record ParsedValue(BigDecimal minValue, BigDecimal maxValue, BigDecimal value, ComparisonType comparisonType) {
    }

    public static ParsedValue parse(String raw, ComparisonType defaultComparison) {
        if (raw == null || raw.isBlank() || "-".equals(raw.trim())) {
            return new ParsedValue(null, null, null, ComparisonType.INFO);
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        Matcher rangeMatcher = RANGE_PATTERN.matcher(normalized);
        if (rangeMatcher.find()) {
            BigDecimal min = parseDecimal(rangeMatcher.group(1));
            BigDecimal max = parseDecimal(rangeMatcher.group(2));
            return new ParsedValue(min, max, max, ComparisonType.RANGE);
        }
        if (normalized.contains("не более") || normalized.contains("не больше")) {
            BigDecimal max = extractLastNumber(normalized);
            return new ParsedValue(null, max, max, ComparisonType.LESS_OR_EQUAL);
        }
        if (normalized.contains("не менее") || normalized.contains("не меньше")) {
            BigDecimal min = extractLastNumber(normalized);
            return new ParsedValue(min, null, min, ComparisonType.GREATER_OR_EQUAL);
        }
        BigDecimal single = parseDecimal(normalized);
        if (single == null) {
            return new ParsedValue(null, null, null, ComparisonType.INFO);
        }
        ComparisonType comparison = defaultComparison != null ? defaultComparison : ComparisonType.LESS_OR_EQUAL;
        return switch (comparison) {
            case GREATER_OR_EQUAL -> new ParsedValue(single, null, single, ComparisonType.GREATER_OR_EQUAL);
            case RANGE -> new ParsedValue(single, single, single, ComparisonType.RANGE);
            default -> new ParsedValue(null, single, single, ComparisonType.LESS_OR_EQUAL);
        };
    }

    private static BigDecimal extractLastNumber(String text) {
        Matcher matcher = NUMBER_PATTERN.matcher(text);
        BigDecimal last = null;
        while (matcher.find()) {
            last = parseDecimal(matcher.group());
        }
        return last;
    }

    public static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim().replace(',', '.').replaceAll("[^0-9.\\-]", ""));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
