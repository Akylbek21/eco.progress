package kz.eco.protocol.validation;

/**
 * Minimal, decoupled view of a single quick-create measurement row, used by
 * {@link ProtocolValidationPolicy#validateMeasurement(int, ProtocolValidationContext, MeasurementInput)}.
 * <p>
 * Deliberately independent from {@code ProtocolApiDtos.QuickCreateMeasurement} so this package has
 * no compile-time dependency on the DTO file (which is edited concurrently elsewhere). The caller
 * is responsible for adapting the real request DTO into this shape.
 *
 * @param factorType           physical-factor sub-type key (e.g. for uv_emf_laser rows)
 * @param factorCode           factor/indicator code, when the row is keyed by a factor table code
 * @param pollutantCode        pollutant code, for air-type templates
 * @param indicatorName        human-readable indicator/parameter name
 * @param value                raw measured value (may be numeric or textual before normalization)
 * @param unit                 unit of measurement
 * @param normativeId          resolved or requested normative id, if any
 * @param measurementDeviceId  id of the measurement device used to obtain this row, if any
 */
public record MeasurementInput(
        String factorType,
        String factorCode,
        String pollutantCode,
        String indicatorName,
        Object value,
        String unit,
        Object normativeId,
        Object measurementDeviceId
) {
}
