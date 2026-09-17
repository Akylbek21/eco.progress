package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Industrial (stationary source) emission protocols. Previously these fell through to the ambient
 * air policy, which demands a sampling place at the СЗЗ boundary - meaningless for a stack. What an
 * emissions row does need is the substance code it reports the mass emission for.
 */
@Component
public class IndustrialEmissionsValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "industrial_emissions";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.objectId() == null) {
            errors.add(error(headerField("objectId"), "OBJECT_REQUIRED", "Укажите объект (objectId)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        List<ProtocolValidationError> errors = validateBaseline(index, measurement);
        if (isBlank(measurement.pollutantCode())) {
            errors.add(error(measurementField(index, "pollutantCode"), "POLLUTANT_CODE_REQUIRED",
                    "Укажите код загрязняющего вещества для строки " + (index + 1)));
        }
        return errors;
    }
}
