package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Water / wastewater protocols: the applicable normative (MPC table) depends on the water type and
 * its use category, so both must be declared at the header level. Also registered for the frontend
 * alias {@code water_wastewater} via {@link ProtocolValidationPolicyRegistry} normalization.
 */
@Component
public class WaterValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "water";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.isConditionBlank("waterType")) {
            errors.add(error(headerField("conditions.waterType"), "WATER_TYPE_REQUIRED",
                    "Укажите тип воды (waterType)"));
        }
        if (context.isConditionBlank("waterUseCategory")) {
            errors.add(error(headerField("conditions.waterUseCategory"), "WATER_USE_CATEGORY_REQUIRED",
                    "Укажите категорию водопользования (waterUseCategory)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        return validateBaseline(index, measurement);
    }
}
