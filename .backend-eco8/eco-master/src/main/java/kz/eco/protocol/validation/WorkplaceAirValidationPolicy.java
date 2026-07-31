package kz.eco.protocol.validation;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Workplace air protocols: same core shape as ambient air (pollutant + device + place), but scoped
 * to a workplace rather than a sanitary protection zone.
 */
@Component
public class WorkplaceAirValidationPolicy extends AbstractProtocolValidationPolicy {

    @Override
    public String templateKey() {
        return "workplace_air";
    }

    @Override
    public List<ProtocolValidationError> validateHeader(ProtocolValidationContext context) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (context.objectId() == null) {
            errors.add(error(headerField("objectId"), "OBJECT_REQUIRED", "Укажите объект (objectId)"));
        }
        if (isBlank(context.measurementPlace())) {
            errors.add(error(headerField("measurementPlace"), "MEASUREMENT_PLACE_REQUIRED",
                    "Укажите место отбора проб (measurementPlace)"));
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
        if (measurement.measurementDeviceId() == null) {
            errors.add(error(measurementField(index, "measurementDeviceId"), "MEASUREMENT_DEVICE_REQUIRED",
                    "Укажите средство измерения для строки " + (index + 1)));
        }
        return errors;
    }
}
