package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Soil protocols: a sample without its number, depth and sampling place is not traceable back to
 * where/how it was taken, so all three are required at the header level.
 */
@Component
public class SoilValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "soil";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.isConditionBlank("sampleNumber")) {
            errors.add(error(headerField("conditions.sampleNumber"), "SOIL_SAMPLE_NUMBER_REQUIRED",
                    "Укажите номер пробы (sampleNumber)"));
        }
        if (context.isConditionBlank("samplingDepth")) {
            errors.add(error(headerField("conditions.samplingDepth"), "SOIL_SAMPLING_DEPTH_REQUIRED",
                    "Укажите глубину отбора пробы (samplingDepth)"));
        }
        if (context.isConditionBlank("samplingPlace")) {
            errors.add(error(headerField("conditions.samplingPlace"), "SOIL_SAMPLING_PLACE_REQUIRED",
                    "Укажите место отбора пробы (samplingPlace)"));
        }
        return errors;
    }

    @Override
    public List<ProtocolValidationError> validateMeasurement(int index, ProtocolValidationContext context, MeasurementInput measurement) {
        return validateBaseline(index, measurement);
    }
}
