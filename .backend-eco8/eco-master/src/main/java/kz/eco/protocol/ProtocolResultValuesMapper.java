package kz.eco.protocol;

import kz.eco.protocol.dto.ProtocolApiDtos;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public final class ProtocolResultValuesMapper {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** "version" is the protocol's optimistic-locking token (see ProtocolService.addResult/
     *  updateResult), never a result-row field - excluding it here keeps it out of both the
     *  known-field mapping AND the extras JSON blob. */
    private static final Set<String> META_KEYS = Set.of(
            "id", "protocolId", "protocol_id", "internalStatus", "checkStatus", "status", "values", "version"
    );

    private static final Set<String> KNOWN_VALUE_KEYS = Set.of(
            "samplingDate", "sampleDate", "samplingPlace", "samplingPoint", "point", "location",
            "sourceNumber", "pollutionSourceNumber", "object", "objectName", "sampleName",
            "indicator", "indicatorName", "unit", "testingMethodDocument", "testingMethod", "method",
            "samplingMethodDocument", "samplingMethod", "temperature", "temperatureC", "speed", "flowSpeedMs",
            "gasVolume", "gasAirVolumeNm3s", "ductArea", "ductAreaM2", "mdvMg", "pdvMgM3", "mdvGs", "pdvGs",
            "resultMg", "resultGs", "pds", "pdsMgDm3", "result", "resultValue", "resultMgDm3",
            "primaryReading", "measurementReadings", "pdk", "pdkMgM3", "normative", "normativeValue",
            "pdkBackground", "pdkOrBackground", "vehicleModel", "plateNumber", "co", "ch", "smokeK", "smokeN",
            "measurementPlace", "workplace", "roomOrWorkplace", "direction", "externalLaboratory",
            "externalLaboratoryName", "subtype", "factorType", "minValue", "min", "normativeMin",
            "maxValue", "max", "normativeMax", "comparisonType", "device", "deviceId", "measurementDeviceId",
            "verificationDate", "validFrom", "validUntil", "verificationValidUntil", "comment", "note",
            "pollutantCode", "code", "methodTemplateId", "uncertaintyValue", "calculationStatus", "calculationMessage",
            "calculatedAt", "normativeId", "normativeDocument", "testingMethodNd", "samplingMethodNd",
            "sourceParameters", "cas", "casNumber", "formula", "normativeSubType", "normativeType",
            "normativeSelectionRequired", "deviceWarning", "normativeWarning",
            "sourceDocumentCode", "sourceDocumentName", "documentNumber", "documentDate",
            "appendixNo", "tableNo", "roomType", "season", "workCategory", "workplaceType", "normLevel",
            "conditionJson"
    );

    private ProtocolResultValuesMapper() {
    }

    static Map<String, Object> fromRequestBody(Map<String, Object> body) {
        if (body == null || body.isEmpty()) {
            return Map.of();
        }
        Object nested = body.get("values");
        if (nested instanceof Map<?, ?> valuesMap) {
            Map<String, Object> merged = new LinkedHashMap<>();
            body.forEach((key, value) -> {
                if (!META_KEYS.contains(key) && !"values".equals(key) && value != null) {
                    merged.put(key, value);
                }
            });
            valuesMap.forEach((key, value) -> merged.put(String.valueOf(key), value));
            return merged;
        }
        Map<String, Object> flat = new LinkedHashMap<>();
        body.forEach((key, value) -> {
            if (!META_KEYS.contains(key) && value != null) {
                flat.put(key, value);
            }
        });
        return flat;
    }

    static Map<String, Object> fromResultRow(ProtocolApiDtos.ResultRow request) {
        if (request == null) {
            return Map.of();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        if (request.values() != null) {
            body.put("values", request.values());
        }
        return fromRequestBody(body);
    }

    public static Map<String, Object> toValues(String templateCode, ProtocolResult result) {
        Map<String, Object> values = new LinkedHashMap<>();
        put(values, "samplingDate", result.getSampleDate());
        put(values, "samplingPlace", result.getSamplingPlace());
        put(values, "samplingPoint", result.getSamplingPlace());
        put(values, "sourceNumber", result.getPollutionSourceNumber());
        put(values, "object", result.getObjectName());
        put(values, "sampleName", result.getSampleName());
        put(values, "indicator", result.getIndicatorName());
        put(values, "pollutantCode", result.getPollutantCode());
        put(values, "unit", result.getUnit());
        put(values, "testingMethodDocument", result.getTestingMethodNd());
        put(values, "testingMethod", result.getTestingMethodNd());
        put(values, "samplingMethodDocument", result.getSamplingMethodNd());
        put(values, "samplingMethod", result.getSamplingMethodNd());
        put(values, "temperature", result.getTemperatureC());
        put(values, "speed", result.getFlowSpeedMs());
        put(values, "gasVolume", result.getGasAirVolumeNm3s());
        put(values, "ductArea", result.getDuctAreaM2());
        put(values, "mdvMg", result.getPdvMgM3());
        put(values, "mdvGs", result.getPdvGs());
        put(values, "resultMg", result.getResultMgM3());
        put(values, "resultGs", result.getResultGs());
        put(values, "pds", result.getPdsMgDm3());
        BigDecimal comparable = firstNonNull(result.getResultValue(), result.getResultMgDm3(), result.getResultMgM3());
        put(values, "result", comparable);
        put(values, "resultValue", result.getResultValue());
        put(values, "primaryReading", firstNonNull(result.getResultValue(), result.getResultMgDm3(), result.getResultMgM3()));
        put(values, "measurementReadings", firstNonNull(result.getResultValue(), result.getResultMgDm3(), result.getResultMgM3()));
        put(values, "pdk", result.getPdkMgM3());
        put(values, "pdkBackground", result.getPdkOrBackground());
        put(values, "vehicleModel", result.getVehicleModel());
        put(values, "plateNumber", result.getPlateNumber());
        put(values, "co", result.getCoPercent());
        put(values, "ch", result.getChPpm());
        put(values, "smokeK", result.getSmokeK());
        put(values, "smokeN", result.getSmokeNPercent());
        put(values, "measurementPlace", result.getMeasurementPlace());
        put(values, "workplace", result.getRoomOrWorkplace());
        put(values, "direction", result.getDirection());
        put(values, "externalLaboratory", result.getExternalLaboratory());
        put(values, "externalLaboratoryName", result.getExternalLaboratoryName());
        put(values, "subtype", result.getSubtype());
        put(values, "factorType", result.getSubtype());
        put(values, "normative", result.getNormativeValue());
        put(values, "normativeMin", result.getMinValue());
        put(values, "normativeMax", result.getMaxValue());
        put(values, "minValue", result.getMinValue());
        put(values, "maxValue", result.getMaxValue());
        put(values, "comparisonType", result.getComparisonType() != null ? result.getComparisonType().name() : null);
        put(values, "device", result.getDeviceId() != null ? String.valueOf(result.getDeviceId()) : null);
        put(values, "deviceId", result.getDeviceId() != null ? String.valueOf(result.getDeviceId()) : null);
        put(values, "measurementDeviceId", result.getDeviceId() != null ? String.valueOf(result.getDeviceId()) : null);
        put(values, "verificationDate", result.getVerificationDate());
        put(values, "validUntil", result.getVerificationValidUntil());
        put(values, "comment", result.getNote());
        put(values, "methodTemplateId", result.getMethodTemplateId());
        put(values, "uncertaintyValue", result.getUncertaintyValue());
        put(values, "calculationStatus", result.getCalculationStatus());
        put(values, "calculationMessage", result.getCalculationMessage());
        put(values, "calculatedAt", result.getCalculatedAt() != null ? result.getCalculatedAt().toString() : null);
        if (result.getNormativeId() != null) {
            put(values, "normativeId", String.valueOf(result.getNormativeId()));
        }
        mergeStoredExtras(values, result.getValuesJson());
        return values;
    }

    static void applyValues(String templateCode, ProtocolResult result, Map<String, Object> values) {
        if (values == null || values.isEmpty()) {
            return;
        }
        result.setSampleDate(readDate(first(values, "samplingDate", "sampleDate")));
        result.setSamplingPlace(readString(first(values, "samplingPlace", "samplingPoint", "point", "location")));
        result.setPollutionSourceNumber(readString(first(values, "sourceNumber", "pollutionSourceNumber")));
        result.setObjectName(readString(first(values, "object", "objectName")));
        result.setSampleName(readString(first(values, "sampleName")));
        result.setIndicatorName(readString(first(values, "indicator", "indicatorName")));
        result.setUnit(readString(first(values, "unit")));
        result.setTestingMethodNd(readString(first(values, "testingMethodDocument", "testingMethod", "method")));
        result.setSamplingMethodNd(readString(first(values, "samplingMethodDocument", "samplingMethod")));
        result.setTemperatureC(readDecimal(first(values, "temperature", "temperatureC")));
        result.setFlowSpeedMs(readDecimal(first(values, "speed", "flowSpeedMs")));
        result.setGasAirVolumeNm3s(readDecimal(first(values, "gasVolume", "gasAirVolumeNm3s")));
        result.setDuctAreaM2(readDecimal(first(values, "ductArea", "ductAreaM2")));
        result.setPdvMgM3(readDecimal(first(values, "mdvMg", "pdvMgM3")));
        result.setPdvGs(readDecimal(first(values, "mdvGs", "pdvGs")));
        BigDecimal reading = readDecimal(first(values, "primaryReading", "measurementReadings"));
        BigDecimal explicitResult = readDecimal(first(values, "resultValue", "result"));
        BigDecimal explicitMg = readDecimal(values.get("resultMg"));
        result.setResultMgM3(firstNonNull(explicitMg, explicitResult, reading));
        result.setResultGs(readDecimal(values.get("resultGs")));
        result.setPdsMgDm3(readDecimal(first(values, "pds", "pdsMgDm3")));
        BigDecimal explicitDm3 = readDecimal(first(values, "resultMgDm3"));
        result.setResultMgDm3(firstNonNull(explicitDm3, explicitResult, reading));
        result.setPdkMgM3(readDecimal(first(values, "pdk", "pdkMgM3", "normative")));
        result.setPdkOrBackground(readDecimal(first(values, "pdkBackground", "pdkOrBackground")));
        result.setResultValue(firstNonNull(explicitResult, reading));
        result.setNormativeValue(readDecimal(first(values, "normative", "normativeValue")));
        result.setVehicleModel(readString(values.get("vehicleModel")));
        result.setPlateNumber(readString(values.get("plateNumber")));
        result.setCoPercent(readDecimal(values.get("co")));
        result.setChPpm(readDecimal(values.get("ch")));
        result.setSmokeK(readDecimal(values.get("smokeK")));
        result.setSmokeNPercent(readDecimal(values.get("smokeN")));
        result.setMeasurementPlace(readString(first(values, "measurementPlace", "location")));
        result.setRoomOrWorkplace(readString(first(values, "workplace", "roomOrWorkplace")));
        result.setDirection(readString(first(values, "direction")));
        String extLab = readString(first(values, "externalLaboratory"));
        if (extLab != null) {
            result.setExternalLaboratory("true".equalsIgnoreCase(extLab) || "1".equals(extLab));
        }
        result.setExternalLaboratoryName(readString(first(values, "externalLaboratoryName")));
        result.setSubtype(readString(first(values, "subtype", "factorType")));
        result.setMinValue(readDecimal(first(values, "minValue", "min", "normativeMin")));
        result.setMaxValue(readDecimal(first(values, "maxValue", "max", "normativeMax")));
        String compType = readString(first(values, "comparisonType"));
        if (compType != null) {
            result.setComparisonType(ComparisonType.fromApi(compType));
        }
        result.setNote(readString(first(values, "comment", "note")));
        String device = readString(first(values, "device", "deviceId", "measurementDeviceId"));
        if (device != null && !device.startsWith("local-")) {
            try {
                result.setDeviceId(Long.parseLong(device));
            } catch (NumberFormatException ignored) {
            }
        }
        result.setVerificationDate(readDate(first(values, "verificationDate", "validFrom")));
        result.setVerificationValidUntil(readDate(first(values, "validUntil", "verificationValidUntil")));
        String pollutantCode = readString(first(values, "pollutantCode", "code"));
        if (pollutantCode != null) {
            result.setPollutantCode(pollutantCode);
        }
        String normativeType = readString(values.get("normativeType"));
        if (normativeType != null) {
            try {
                result.setNormativeType(NormativeType.valueOf(normativeType.trim().toUpperCase()));
            } catch (IllegalArgumentException ignored) {
            }
        }
        String normativeIdStr = readString(first(values, "normativeId"));
        if (normativeIdStr != null) {
            try {
                result.setNormativeId(Long.parseLong(normativeIdStr));
            } catch (NumberFormatException ignored) {
            }
        }
        String methodTemplateIdStr = readString(first(values, "methodTemplateId"));
        if (methodTemplateIdStr != null) {
            try {
                result.setMethodTemplateId(Long.parseLong(methodTemplateIdStr));
            } catch (NumberFormatException ignored) {
            }
        }
        persistExtraValues(result, values);
    }

    public static void setExtraFlag(ProtocolResult result, String key, String value) {
        Map<String, Object> extras = readExtras(result.getValuesJson());
        if (value == null) {
            extras.remove(key);
        } else {
            extras.put(key, value);
        }
        writeExtras(result, extras);
    }

    public static Map<String, Object> readValuesMap(ProtocolResult result) {
        Map<String, Object> values = toValues(null, result);
        mergeStoredExtras(values, result.getValuesJson());
        return values;
    }

    public static void mergeNormativeSnapshot(ProtocolResult result, Map<String, Object> snapshot) {
        if (snapshot == null || snapshot.isEmpty()) {
            return;
        }
        Map<String, Object> extras = readExtras(result.getValuesJson());
        extras.putAll(snapshot);
        writeExtras(result, extras);
    }

    static void persistExtraValues(ProtocolResult result, Map<String, Object> source) {
        Map<String, Object> extras = readExtras(result.getValuesJson());
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            String key = entry.getKey();
            if (!KNOWN_VALUE_KEYS.contains(key) && entry.getValue() != null) {
                extras.put(key, entry.getValue());
            }
        }
        writeExtras(result, extras);
    }

    private static void mergeStoredExtras(Map<String, Object> values, String valuesJson) {
        readExtras(valuesJson).forEach(values::putIfAbsent);
    }

    private static Map<String, Object> readExtras(String valuesJson) {
        if (valuesJson == null || valuesJson.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return new LinkedHashMap<>(OBJECT_MAPPER.readValue(valuesJson, new TypeReference<>() {}));
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    private static void writeExtras(ProtocolResult result, Map<String, Object> extras) {
        if (extras == null || extras.isEmpty()) {
            result.setValuesJson(null);
            return;
        }
        try {
            result.setValuesJson(OBJECT_MAPPER.writeValueAsString(extras));
        } catch (Exception ex) {
            result.setValuesJson(null);
        }
    }

    public static ProtocolApiDtos.ResultRow toRow(ProtocolResult result) {
        return new ProtocolApiDtos.ResultRow(
                String.valueOf(result.getId()),
                String.valueOf(result.getProtocolId()),
                result.getInternalStatus() != null ? result.getInternalStatus().name() : null,
                toValues(null, result)
        );
    }

    private static Object first(Map<String, Object> values, String... keys) {
        for (String key : keys) {
            Object value = values.get(key);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static void put(Map<String, Object> values, String key, Object value) {
        if (value != null) {
            values.put(key, value instanceof LocalDate date ? date.toString() : value);
        }
    }

    private static String readString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static LocalDate readDate(Object value) {
        String text = readString(value);
        return text != null ? LocalDate.parse(text) : null;
    }

    private static BigDecimal readDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(String.valueOf(value).replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static BigDecimal firstNonNull(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
