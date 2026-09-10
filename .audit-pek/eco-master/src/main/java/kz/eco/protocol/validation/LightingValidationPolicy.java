package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Lighting protocols: the applicable illumination norm depends on room type, workplace type and
 * the kind of lighting being measured (natural/artificial/combined), so all three must be declared
 * at the header level.
 */
@Component
public class LightingValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "lighting";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.isConditionBlank("roomType")) {
            errors.add(error(headerField("conditions.roomType"), "LIGHTING_ROOM_TYPE_REQUIRED",
                    "Укажите тип помещения (roomType)"));
        }
        if (context.isConditionBlank("workplaceType")) {
            errors.add(error(headerField("conditions.workplaceType"), "LIGHTING_WORKPLACE_TYPE_REQUIRED",
                    "Укажите тип рабочего места (workplaceType)"));
        }
        if (context.isConditionBlank("lightingType")) {
            errors.add(error(headerField("conditions.lightingType"), "LIGHTING_TYPE_REQUIRED",
                    "Укажите вид освещения (lightingType)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        return validateBaseline(index, measurement);
    }
}
