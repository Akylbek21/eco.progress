package kz.eco.protocol.validation;

import java.util.ArrayList;
import java.util.List;

/**
 * Base class for the 8 concrete per-type policies. Centralizes the baseline measurement checks that
 * every protocol type shares, so concrete policies only implement what is actually type-specific.
 */
public abstract class AbstractProtocolValidationPolicy implements ProtocolValidationPolicy {

    /**
     * Baseline checks shared by every protocol type: an indicator name, a non-null value and a unit
     * are required for every measurement row regardless of type. Concrete policies call this first
     * from {@link #validateMeasurement(int, ProtocolValidationContext, MeasurementInput)} and append
     * their own type-specific checks to the returned (mutable) list.
     */
    protected List<ProtocolValidationError> validateBaseline(int index, MeasurementInput measurement) {
        List<ProtocolValidationError> errors = new ArrayList<>();
        if (isBlank(measurement.indicatorName())) {
            errors.add(error(measurementField(index, "indicatorName"), "MEASUREMENT_INDICATOR_NAME_REQUIRED",
                    "Укажите indicatorName для строки " + (index + 1)));
        }
        if (measurement.value() == null) {
            errors.add(error(measurementField(index, "value"), "MEASUREMENT_VALUE_REQUIRED",
                    "Укажите значение (value) для строки " + (index + 1)));
        }
        if (isBlank(measurement.unit())) {
            errors.add(error(measurementField(index, "unit"), "MEASUREMENT_UNIT_REQUIRED",
                    "Укажите единицу измерения для строки " + (index + 1)));
        }
        return errors;
    }

    protected static String headerField(String name) {
        return "header." + name;
    }

    protected static String measurementField(int index, String name) {
        return "measurements." + index + "." + name;
    }

    protected static ProtocolValidationError error(String field, String code, String message) {
        return new ProtocolValidationError(field, code, message);
    }

    protected static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
