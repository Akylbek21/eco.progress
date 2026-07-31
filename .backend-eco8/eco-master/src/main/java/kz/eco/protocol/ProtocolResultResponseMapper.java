package kz.eco.protocol;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ProtocolResultResponseMapper {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ProtocolResultResponseMapper() {
    }

    public static Map<String, Object> toResponse(ProtocolResult result) {
        Map<String, Object> values = ProtocolResultValuesMapper.toValues(null, result);
        mergeExtraValues(values, result.getValuesJson());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", String.valueOf(result.getId()));
        response.put("protocolId", String.valueOf(result.getProtocolId()));
        String status = result.getInternalStatus() != null ? result.getInternalStatus().name() : ResultInternalStatus.EMPTY_RESULT.name();
        response.put("internalStatus", status);
        response.put("checkStatus", status);

        String resultText = formatDecimal(resolveComparableValue(result));
        String normativeText = formatDecimal(result.getNormativeValue());
        response.put("result", resultText);
        response.put("primaryReading", resultText);
        response.put("normative", normativeText);
        response.put("normativeValue", normativeText);
        response.put("code", result.getPollutantCode());
        response.put("pollutantCode", result.getPollutantCode());
        response.put("indicator", result.getIndicatorName());
        response.put("indicatorName", result.getIndicatorName());
        response.put("unit", result.getUnit());
        if (result.getComparisonType() != null) {
            response.put("comparisonType", result.getComparisonType().name());
        }
        if (result.getNormativeType() != null) {
            response.put("normativeType", result.getNormativeType().name());
        }
        response.put("calculationStatus", result.getCalculationStatus() != null
                ? result.getCalculationStatus() : "MANUAL");
        response.put("calculationMessage", result.getCalculationMessage());
        response.put("uncertaintyValue", formatDecimal(result.getUncertaintyValue()));

        if (result.getDeviceId() != null) {
            String deviceId = String.valueOf(result.getDeviceId());
            response.put("deviceId", deviceId);
            response.put("measurementDeviceId", deviceId);
            values.putIfAbsent("deviceId", deviceId);
            values.putIfAbsent("measurementDeviceId", deviceId);
            Map<String, Object> deviceSummary = measurementDeviceSummary(result.getDeviceId(), values);
            if (deviceSummary != null) {
                response.put("measurementDevice", deviceSummary);
            }
        }
        if (result.getNormativeId() != null) {
            response.put("normativeId", String.valueOf(result.getNormativeId()));
            values.putIfAbsent("normativeId", String.valueOf(result.getNormativeId()));
        }

        values.put("normativeMin", formatDecimal(result.getMinValue()));
        values.put("normativeMax", formatDecimal(result.getMaxValue()));
        values.put("factorType", result.getSubtype());
        Object readings = values.get("measurementReadings");
        if (readings != null) {
            response.put("measurementReadings", readings);
        } else if (resultText != null) {
            response.put("measurementReadings", List.of(resultText));
        }
        copyIfPresent(values, response, "normativeSubType", "casNumber", "formula", "deviceWarning");
        response.put("values", values);
        return response;
    }

    /**
     * Builds the nested "measurementDevice" summary purely from the snapshot fields already
     * merged into `values` (written once by ProtocolService.deviceSnapshot when the device was
     * attached) - no repository lookup here, so listing a protocol's results never N+1-queries
     * measurement_devices, and an edited/archived device never changes what an already-issued
     * result reports.
     */
    private static Map<String, Object> measurementDeviceSummary(Long deviceId, Map<String, Object> values) {
        Object name = values.get("measurementDeviceName");
        if (name == null) {
            return null;
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", String.valueOf(deviceId));
        summary.put("name", name);
        summary.put("model", values.get("measurementDeviceModel"));
        summary.put("serialNumber", values.get("measurementDeviceSerialNumber"));
        summary.put("verificationNumber", values.get("measurementDeviceVerificationNumber"));
        summary.put("verificationValidUntil", values.get("measurementDeviceVerificationValidUntil"));
        return summary;
    }

    private static void mergeExtraValues(Map<String, Object> values, String valuesJson) {
        if (valuesJson == null || valuesJson.isBlank()) {
            return;
        }
        try {
            Map<String, Object> extra = OBJECT_MAPPER.readValue(valuesJson, new TypeReference<>() {});
            extra.forEach(values::putIfAbsent);
        } catch (Exception ignored) {
        }
    }

    private static String formatDecimal(BigDecimal value) {
        return value != null ? value.stripTrailingZeros().toPlainString() : null;
    }

    private static void copyIfPresent(Map<String, Object> values, Map<String, Object> response, String... keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value != null) {
                response.put(key, value);
            }
        }
    }

    private static BigDecimal resolveComparableValue(ProtocolResult result) {
        if (result.getResultValue() != null) return result.getResultValue();
        if (result.getResultMgM3() != null) return result.getResultMgM3();
        if (result.getResultMgDm3() != null) return result.getResultMgDm3();
        if (result.getCoPercent() != null) return result.getCoPercent();
        return null;
    }
}
