package kz.eco.normative;

import kz.eco.common.SearchTextUtils;
import kz.eco.protocol.dto.ProtocolApiDtos;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class NormativeMatchingUtils {

    private NormativeMatchingUtils() {
    }

    public static boolean matches(ProtocolApiDtos.NormativeRecord record, String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return true;
        }
        if (matchesToken(record, SearchTextUtils.normalizeText(rawQuery))) {
            return true;
        }
        for (String token : SearchTextUtils.searchTokens(rawQuery)) {
            String normalized = SearchTextUtils.normalizeText(token);
            if (!normalized.isBlank() && matchesToken(record, normalized)) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesToken(ProtocolApiDtos.NormativeRecord record, String token) {
        for (String value : searchableValues(record)) {
            if (contains(value, token)) {
                return true;
            }
        }
        if (token.matches("\\d{3,4}")) {
            String normalizedCode = SearchTextUtils.normalizeText(
                    PollutantCodeUtils.normalizePollutantCode(token));
            // Arrays.asList (not List.of): either element may legitimately be null here, and
            // List.of throws NPE on a null element instead of just skipping it.
            for (String codeValue : Arrays.asList(record.code(), record.pollutantCode())) {
                if (codeValue != null && SearchTextUtils.normalizeText(
                        PollutantCodeUtils.normalizePollutantCode(codeValue)).equals(normalizedCode)) {
                    return true;
                }
            }
        }
        return false;
    }

    static List<String> searchableValues(ProtocolApiDtos.NormativeRecord record) {
        List<String> values = new ArrayList<>();
        add(values, record.code());
        add(values, record.pollutantCode());
        add(values, record.indicator());
        add(values, record.indicatorName());
        add(values, record.indicatorNameRu());
        add(values, record.indicatorNameKz());
        add(values, record.pollutantName());
        add(values, record.formType());
        add(values, record.matrixType());
        add(values, record.assessmentCategory());
        add(values, record.pollutionDegree());
        add(values, record.casNumber());
        add(values, record.formula());
        add(values, record.chemicalFormula());
        add(values, record.environment());
        add(values, record.researchObject());
        add(values, record.environmentType());
        add(values, record.normativeDocument());
        add(values, record.testingMethod());
        add(values, record.samplingMethod());
        add(values, record.templateId());
        add(values, record.templateType());
        add(values, record.normativeType());
        add(values, record.normativeSubType());
        add(values, record.hazardClass());
        add(values, record.limitingIndicator());
        add(values, record.unit());
        add(values, record.value());
        add(values, record.normativeValue());
        add(values, record.min());
        add(values, record.max());
        add(values, record.sourceFile());
        add(values, record.synonyms());
        return values;
    }

    private static void add(List<String> values, String value) {
        if (value != null && !value.isBlank()) {
            values.add(value);
        }
    }

    private static boolean contains(String value, String token) {
        return value != null && SearchTextUtils.normalizeText(value).contains(token);
    }
}
