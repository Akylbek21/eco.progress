package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Microclimate protocols: the applicable norms depend on season, work severity category and room
 * type, so all three must be declared at the header level.
 */
@Component
public class MicroclimateValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "microclimate";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.isConditionBlank("season")) {
            errors.add(error(headerField("conditions.season"), "MICROCLIMATE_SEASON_REQUIRED",
                    "Укажите период года (season)"));
        }
        if (context.isConditionBlank("workCategory")) {
            errors.add(error(headerField("conditions.workCategory"), "MICROCLIMATE_WORK_CATEGORY_REQUIRED",
                    "Укажите категорию работ (workCategory)"));
        }
        if (context.isConditionBlank("roomType")) {
            errors.add(error(headerField("conditions.roomType"), "MICROCLIMATE_ROOM_TYPE_REQUIRED",
                    "Укажите тип помещения (roomType)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        // Unit is already required by the shared baseline; microclimate has no additional
        // per-measurement rule beyond it.
        return validateBaseline(index, measurement);
    }
}
