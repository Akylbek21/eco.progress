package kz.eco.normative;

import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.ProtocolApiMapper;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultValuesMapper;
import kz.eco.protocol.dto.ProtocolApiDtos;

import java.util.LinkedHashMap;
import java.util.Map;

public final class NormativeSnapshotHelper {

    private NormativeSnapshotHelper() {
    }

    public static void applySnapshotToResult(ProtocolResult result, NormativeRecord normative) {
        if (normative == null) {
            return;
        }
        Map<String, Object> snapshot = buildSnapshot(normative);
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, snapshot);
        if (normative.getId() != null) {
            result.setNormativeId(normative.getId());
        }
        result.setNormativeValue(normative.getValue());
        result.setMinValue(normative.getMinValue());
        result.setMaxValue(normative.getMaxValue());
        result.setComparisonType(normative.getComparisonType());
        if (result.getUnit() == null || result.getUnit().isBlank()) {
            result.setUnit(normative.getUnit());
        }
    }

    public static void applySnapshotToResult(ProtocolResult result, ProtocolApiDtos.NormativeRecord normative) {
        if (normative == null) {
            return;
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        put(snapshot, "normativeId", normative.id());
        put(snapshot, "sourceDocumentCode", normative.sourceDocumentCode());
        put(snapshot, "sourceDocumentName", normative.sourceDocumentName());
        put(snapshot, "documentNumber", normative.documentNumber());
        put(snapshot, "documentDate", normative.documentDate());
        put(snapshot, "appendixNo", normative.appendixNo());
        put(snapshot, "tableNo", normative.tableNo());
        put(snapshot, "factorType", normative.factorType());
        put(snapshot, "factorCode", normative.factorCode());
        put(snapshot, "season", normative.season());
        put(snapshot, "workCategory", normative.workCategory());
        put(snapshot, "workplaceType", normative.workplaceType());
        put(snapshot, "roomType", normative.roomType());
        put(snapshot, "normLevel", normative.normLevel());
        put(snapshot, "min", normative.min());
        put(snapshot, "max", normative.max());
        put(snapshot, "value", normative.value());
        put(snapshot, "unit", normative.unit());
        put(snapshot, "comparisonType", normative.comparisonType());
        put(snapshot, "normativeDocument", normative.normativeDocument());
        put(snapshot, "indicatorName", firstNonBlank(normative.indicatorName(), normative.indicatorNameRu(), normative.indicator()));
        put(snapshot, "formType", normative.formType());
        put(snapshot, "limitingIndicator", normative.limitingIndicator());
        put(snapshot, "matrixType", normative.matrixType());
        put(snapshot, "assessmentCategory", normative.assessmentCategory());
        put(snapshot, "pollutionDegree", normative.pollutionDegree());
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, snapshot);
        if (normative.id() != null && !normative.id().isBlank()) {
            try {
                result.setNormativeId(Long.parseLong(normative.id()));
            } catch (NumberFormatException ignored) {
            }
        }
        result.setNormativeValue(parseDecimal(normative.value()));
        result.setMinValue(parseDecimal(normative.min()));
        result.setMaxValue(parseDecimal(normative.max()));
        result.setComparisonType(ComparisonType.fromApi(normative.comparisonType()));
    }

    public static Map<String, Object> buildSnapshot(NormativeRecord normative) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        put(snapshot, "normativeId", normative.getId() != null ? String.valueOf(normative.getId()) : null);
        put(snapshot, "sourceDocumentCode", normative.getSourceDocumentCode());
        put(snapshot, "sourceDocumentName", NormativeApiContract.resolveSourceDocumentName(normative.getSourceDocumentCode()));
        put(snapshot, "documentNumber", normative.getDocumentNumber());
        put(snapshot, "documentDate", ProtocolApiMapper.formatDate(normative.getDocumentDate()));
        put(snapshot, "appendixNo", normative.getAppendixNo());
        put(snapshot, "tableNo", normative.getTableNo());
        put(snapshot, "factorType", normative.getFactorType());
        put(snapshot, "factorCode", normative.getFactorCode());
        put(snapshot, "season", normative.getSeason());
        put(snapshot, "workCategory", normative.getWorkCategory());
        put(snapshot, "workplaceType", normative.getWorkplaceType());
        put(snapshot, "roomType", normative.getRoomType());
        put(snapshot, "normLevel", normative.getNormLevel());
        put(snapshot, "min", ProtocolApiMapper.decimalToString(normative.getMinValue()));
        put(snapshot, "max", ProtocolApiMapper.decimalToString(normative.getMaxValue()));
        put(snapshot, "value", ProtocolApiMapper.decimalToString(normative.getValue()));
        put(snapshot, "unit", normative.getUnit());
        put(snapshot, "comparisonType", normative.getComparisonType() != null
                ? normative.getComparisonType().name() : null);
        put(snapshot, "normativeDocument", normative.getNormativeDocument());
        put(snapshot, "indicatorName", normative.getIndicatorNameRu());
        put(snapshot, "formType", normative.getFormType());
        put(snapshot, "limitingIndicator", normative.getLimitingIndicator());
        put(snapshot, "matrixType", normative.getMatrixType());
        put(snapshot, "assessmentCategory", normative.getAssessmentCategory());
        put(snapshot, "pollutionDegree", normative.getPollutionDegree());
        return snapshot;
    }

    public static boolean hasNormativeSnapshot(ProtocolResult result) {
        Map<String, Object> values = ProtocolResultValuesMapper.readValuesMap(result);
        return values.containsKey("normativeId") || values.containsKey("sourceDocumentCode");
    }

    private static void put(Map<String, Object> map, String key, Object value) {
        if (value != null) {
            map.put(key, value);
        }
    }

    private static java.math.BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new java.math.BigDecimal(raw.trim().replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
