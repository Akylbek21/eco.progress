package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * UV / EMF / laser protocols: this template covers several distinct physical factors under one
 * umbrella, so the header must declare which sub-factor (factorType) was actually measured, and
 * every row must carry at least one identifying code (factorCode or factorType) since there is no
 * single shared pollutant/indicator code across sub-factors.
 */
@Component
public class UvEmfLaserValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "uv_emf_laser";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.isConditionBlank("factorType")) {
            errors.add(error(headerField("conditions.factorType"), "PHYSICAL_FACTOR_TYPE_REQUIRED",
                    "Укажите вид физического фактора (factorType)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        List<ProtocolValidationError> errors = validateBaseline(index, measurement);
        if (isBlank(measurement.factorCode()) && isBlank(measurement.factorType())) {
            errors.add(error(measurementField(index, "factorCode"), "MEASUREMENT_FACTOR_CODE_REQUIRED",
                    "Укажите factorCode или factorType для строки " + (index + 1)));
        }
        return errors;
    }
}
