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
        // Code-style matching: "123" must find "0123", "01-23", and "01 23" alike (module spec
        // §19.3) - strip separators (dashes/spaces, already-collapsed by normalizeText upstream)
        // from BOTH the query token and each candidate code value before comparing, on top of the
        // existing leading-zero restoration. Only applies once the separators are gone and what's
        // left is purely digits - never strip separators out of a genuinely textual code.
        String strippedToken = stripCodeSeparators(token);
        if (strippedToken.matches("\\d{3,4}")) {
            String normalizedCode = PollutantCodeUtils.normalizePollutantCode(strippedToken);
            // Arrays.asList (not List.of): either element may legitimately be null here, and
            // List.of throws NPE on a null element instead of just skipping it.
            for (String codeValue : Arrays.asList(record.code(), record.pollutantCode())) {
                if (codeValue == null) {
                    continue;
                }
                String strippedCandidate = stripCodeSeparators(SearchTextUtils.normalizeText(codeValue));
                if (strippedCandidate.matches("\\d{3,4}")
                        && PollutantCodeUtils.normalizePollutantCode(strippedCandidate).equals(normalizedCode)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Removes dashes/spaces so "01-23" and "01 23" compare equal to "0123" - never touches
     *  letters, so a genuinely alphanumeric code (e.g. "NOISE-1") is left alone by the digit-only
     *  guard at each call site. */
    private static String stripCodeSeparators(String value) {
        return value == null ? "" : value.replaceAll("[\\s-]+", "");
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
