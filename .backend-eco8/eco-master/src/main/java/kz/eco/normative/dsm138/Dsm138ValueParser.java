package kz.eco.normative.dsm138;

import kz.eco.protocol.ComparisonType;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Normalizes the free-text "Нормативы (ПДК)" cell from the DSM_138 water tables into a structured
 * comparison. Rules (see ticket): "6-9" -> RANGE; "0,5" / "не более 50" -> LESS_OR_EQUAL;
 * "Отсутствие" -> ABSENT; "1000 (1500)" -> LESS_OR_EQUAL(1000) + alternative value 1500 with a
 * note that the bracketed value applies under separate conditions of the source document.
 */
public final class Dsm138ValueParser {

    private static final Pattern PARENTHETICAL_PATTERN = Pattern.compile(
            "^(-?\\d+(?:[.,]\\d+)?)\\s*\\((-?\\d+(?:[.,]\\d+)?)\\)$");
    private static final Pattern RANGE_PATTERN = Pattern.compile(
            "(-?\\d+(?:[.,]\\d+)?)\\s*[-–—]\\s*(-?\\d+(?:[.,]\\d+)?)");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("-?\\d+(?:[.,]\\d+)?");
    private static final String ALTERNATIVE_VALUE_NOTE =
            "Значение в скобках применяется по отдельному решению/условиям документа";

    private Dsm138ValueParser() {
    }

    public record ParsedValue(
            ComparisonType comparisonType,
            BigDecimal value,
            BigDecimal minValue,
            BigDecimal maxValue,
            BigDecimal alternativeValue,
            String notes,
            String rawValue
    ) {
    }

    public static ParsedValue parse(String raw) {
        if (raw == null || raw.isBlank() || "-".equals(raw.trim())) {
            return new ParsedValue(ComparisonType.INFO, null, null, null, null, null, raw);
        }
        String trimmed = raw.trim();
        String normalized = trimmed.toLowerCase(Locale.ROOT);

        if (normalized.contains("отсутствие") || normalized.contains("не обнаружено")) {
            return new ParsedValue(ComparisonType.ABSENT, null, null, null, null, null, trimmed);
        }

        Matcher parenMatcher = PARENTHETICAL_PATTERN.matcher(trimmed);
        if (parenMatcher.matches()) {
            BigDecimal main = parseDecimal(parenMatcher.group(1));
            BigDecimal alternative = parseDecimal(parenMatcher.group(2));
            return new ParsedValue(ComparisonType.LESS_OR_EQUAL, main, null, main, alternative,
                    ALTERNATIVE_VALUE_NOTE, trimmed);
        }

        Matcher rangeMatcher = RANGE_PATTERN.matcher(normalized);
        if (rangeMatcher.find()) {
            BigDecimal min = parseDecimal(rangeMatcher.group(1));
            BigDecimal max = parseDecimal(rangeMatcher.group(2));
            return new ParsedValue(ComparisonType.RANGE, max, min, max, null, null, trimmed);
        }

        if (normalized.contains("не более") || normalized.contains("не больше")) {
            BigDecimal max = extractLastNumber(normalized);
            return new ParsedValue(ComparisonType.LESS_OR_EQUAL, max, null, max, null, null, trimmed);
        }
        if (normalized.contains("не менее") || normalized.contains("не меньше")) {
            BigDecimal min = extractLastNumber(normalized);
            return new ParsedValue(ComparisonType.GREATER_OR_EQUAL, min, min, null, null, null, trimmed);
        }

        BigDecimal single = parseDecimal(normalized);
        if (single == null) {
            // Unparseable free text (e.g. a footnote) - surface as INFO with the raw text kept,
            // rather than silently dropping it.
            return new ParsedValue(ComparisonType.INFO, null, null, null, null, null, trimmed);
        }
        return new ParsedValue(ComparisonType.LESS_OR_EQUAL, single, null, single, null, null, trimmed);
    }

    private static BigDecimal extractLastNumber(String text) {
        Matcher matcher = NUMBER_PATTERN.matcher(text);
        BigDecimal last = null;
        while (matcher.find()) {
            last = parseDecimal(matcher.group());
        }
        return last;
    }

    private static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim().replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
