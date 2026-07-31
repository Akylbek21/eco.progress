package kz.eco.protocol.calculation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class ProtocolCalculationDtos {

    public record MethodTemplateResponse(
            Long id, String code, String name, String protocolTemplateCode,
            String pollutantCode, String pollutantName, String methodDocument,
            String measurementUnit, String resultUnit, String formulaExpression,
            Integer decimalPlaces, Boolean active, List<MethodVariableResponse> variables
    ) {}

    public record MethodVariableResponse(
            Long id, String variableKey, String variableLabel, String unit,
            String type, Boolean required, BigDecimal minValue, BigDecimal maxValue,
            BigDecimal defaultValue, Integer displayOrder
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RawMeasurementRequest(
            String variableKey, BigDecimal variableValue, String unit,
            String sourceType, Long deviceId
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SaveRawMeasurementsRequest(
            Long methodTemplateId, List<RawMeasurementRequest> measurements
    ) {}

    public record RawMeasurementsResponse(
            Long protocolId, Long resultId, MethodTemplateResponse methodTemplate,
            List<MethodVariableResponse> variables,
            List<RawMeasurementEntry> measurements,
            String calculationStatus, String calculationMessage
    ) {}

    public record SaveRawMeasurementsResponse(Map<String, Object> row) {}

    public record RawMeasurementEntry(
            Long id, String variableKey, BigDecimal variableValue, String unit, String sourceType
    ) {}

    public record CalculationResultResponse(
            Long protocolId, Long resultId, BigDecimal result, BigDecimal uncertaintyValue,
            BigDecimal normativeValue, String internalStatus, String calculationStatus,
            String calculationMessage, List<String> warnings, Map<String, Object> row
    ) {}

    public record ProtocolCalculationSummaryResponse(
            Long protocolId, int total, int calculated, int manual, int waitingInputs,
            int needsRepeat, int normativeNotFound, int errors, int exceeded, int complies,
            List<CalculationResultResponse> rows
    ) {}

    public record CalculationHistoryResponse(
            Long id, String inputJson, String formulaExpression, BigDecimal calculatedValue,
            BigDecimal averageValue, BigDecimal uncertaintyValue, BigDecimal finalResult,
            BigDecimal normativeValue, String complianceStatus, String status,
            String warningsJson, String createdAt, Long createdBy
    ) {}
}
