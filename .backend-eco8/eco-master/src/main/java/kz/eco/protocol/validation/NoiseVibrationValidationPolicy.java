package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Noise / vibration protocols: the applicable norm depends on room type, workplace type and the
 * kind of noise (constant/non-constant, etc.), so all three must be declared at the header level.
 */
@Component
public class NoiseVibrationValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "noise_vibration";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.isConditionBlank("roomType")) {
            errors.add(error(headerField("conditions.roomType"), "NOISE_ROOM_TYPE_REQUIRED",
                    "Укажите тип помещения (roomType)"));
        }
        if (context.isConditionBlank("workplaceType")) {
            errors.add(error(headerField("conditions.workplaceType"), "NOISE_WORKPLACE_TYPE_REQUIRED",
                    "Укажите тип рабочего места (workplaceType)"));
        }
        if (context.isConditionBlank("noiseType")) {
            errors.add(error(headerField("conditions.noiseType"), "NOISE_TYPE_REQUIRED",
                    "Укажите вид шума (noiseType)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        return validateBaseline(index, measurement);
    }
}
