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

    /** version is mandatory (module fix: previously absent entirely) - the caller must always name
     *  the protocol version it read before saving raw measurements. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SaveRawMeasurementsRequest(
            Long methodTemplateId, List<RawMeasurementRequest> measurements, Long version
    ) {}

    /** Optimistic-locking token for calculate/{resultId}/calculate - mandatory (module fix:
     *  previously null meant "don't check"). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CalculateRequest(Long version) {}

    public record RawMeasurementsResponse(
            Long protocolId, Long resultId, MethodTemplateResponse methodTemplate,
            List<MethodVariableResponse> variables,
            List<RawMeasurementEntry> measurements,
            String calculationStatus, String calculationMessage
    ) {}

    /** Module fix P0 item 1: previously only returned {@code row}, forcing the client to re-fetch
     *  the protocol just to learn the new optimistic-locking version after a successful save -
     *  now returns the actual post-mutation {@code protocol.getVersion()} directly. */
    public record SaveRawMeasurementsResponse(Long version, Map<String, Object> row) {}

    public record RawMeasurementEntry(
            Long id, String variableKey, BigDecimal variableValue, String unit, String sourceType
    ) {}

    /** P0 item 1: protocolVersion is the post-mutation @Version token returned so the client
     *  does not need a separate GET to learn the new optimistic-locking value. */
    public record CalculationResultResponse(
            Long protocolId, Long resultId, BigDecimal result, BigDecimal uncertaintyValue,
            BigDecimal normativeValue, String internalStatus, String calculationStatus,
            String calculationMessage, List<String> warnings, Map<String, Object> row,
            Long protocolVersion
    ) {}

    /** P0 item 1: same token at the batch level — one version bump for all rows. */
    public record ProtocolCalculationSummaryResponse(
            Long protocolId, int total, int calculated, int manual, int waitingInputs,
            int needsRepeat, int normativeNotFound, int errors, int exceeded, int complies,
            List<CalculationResultResponse> rows, Long protocolVersion
    ) {}

    public record CalculationHistoryResponse(
            Long id, String inputJson, String formulaExpression, BigDecimal calculatedValue,
            BigDecimal averageValue, BigDecimal uncertaintyValue, BigDecimal finalResult,
            BigDecimal normativeValue, String complianceStatus, String status,
            String warningsJson, String createdAt, Long createdBy
    ) {}
}
