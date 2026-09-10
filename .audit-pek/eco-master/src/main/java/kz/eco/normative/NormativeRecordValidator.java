package kz.eco.normative;

import kz.eco.common.exception.ValidationException;
import kz.eco.protocol.ComparisonType;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/** Shared create/update validation for {@link NormativeRecord}, used by both
 *  {@link NormativeManagementService#create} and {@link NormativeManagementService#update} so a
 *  PATCH that only touches one field still gets checked against the record's final,
 *  post-merge state (not just the raw request). */
public final class NormativeRecordValidator {

    private NormativeRecordValidator() {
    }

    public static void requireIndicatorAndSource(String indicatorName, String sourceDocumentCode, Map<String, String> errors) {
        if (indicatorName == null || indicatorName.isBlank()) {
            errors.put("indicator", "Укажите наименование показателя");
        }
        if (sourceDocumentCode == null || sourceDocumentCode.isBlank()) {
            errors.put("sourceDocumentCode", "Укажите sourceDocumentCode");
        }
    }

    public static String validateAndNormalizeTemplateId(String templateId, Map<String, String> errors) {
        if (templateId == null || templateId.isBlank()) {
            errors.put("templateId", "Укажите templateId");
            return null;
        }
        String normalized = NormativeApiContract.normalizeTemplateId(templateId);
        if (!NormativeApiContract.CANONICAL_TEMPLATE_IDS.contains(normalized)) {
            errors.put("templateId", "Неизвестный templateId: " + templateId);
            return null;
        }
        return normalized;
    }

    public static BigDecimal parseNumeric(String field, String rawValue, Map<String, String> errors) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(rawValue.trim().replace(',', '.'));
        } catch (NumberFormatException e) {
            errors.put(field, "Некорректный числовой формат");
            return null;
        }
    }

    public static ComparisonType parseComparisonType(String rawValue, Map<String, String> errors) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        try {
            return ComparisonType.fromApi(rawValue);
        } catch (RuntimeException e) {
            errors.put("comparisonType", "Неизвестный comparisonType: " + rawValue);
            return null;
        }
    }

    public static FactorType parseFactorType(String rawValue, Map<String, String> errors) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        try {
            return FactorType.fromApi(rawValue);
        } catch (ValidationException e) {
            errors.put("factorType", e.getMessage());
            return null;
        }
    }

    /** Validates the comparisonType-vs-value/min/max rules against the record's FINAL
     *  (post-merge) state. */
    public static void validateComparisonRules(ComparisonType comparisonType, BigDecimal value,
                                                BigDecimal min, BigDecimal max, Map<String, String> errors) {
        if (comparisonType == null) {
            return;
        }
        switch (comparisonType) {
            case RANGE, BETWEEN -> {
                if (min == null) {
                    errors.put("minValue", "Для RANGE обязателен minValue");
                }
                if (max == null) {
                    errors.put("maxValue", "Для RANGE обязателен maxValue");
                }
                if (min != null && max != null && min.compareTo(max) > 0) {
                    errors.put("minValue", "Минимум не может быть больше максимума");
                }
            }
            case LESS_OR_EQUAL, GREATER_OR_EQUAL, EQUAL -> {
                if (value == null) {
                    errors.put("value", "Для " + comparisonType + " требуется числовое значение");
                }
            }
            case ABSENT, INFO -> {
                // Value is optional for these comparison types.
            }
        }
    }

    public static Map<String, String> newErrorMap() {
        return new LinkedHashMap<>();
    }

    public static void throwIfErrors(Map<String, String> errors) {
        if (!errors.isEmpty()) {
            throw new ValidationException("Некорректные данные норматива", errors);
        }
    }
}
