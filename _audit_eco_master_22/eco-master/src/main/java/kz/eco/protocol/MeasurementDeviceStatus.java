package kz.eco.protocol;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public enum MeasurementDeviceStatus {
    VALID,
    EXPIRING,
    EXPIRED,
    ARCHIVED;

    public static MeasurementDeviceStatus resolve(LocalDate validUntil) {
        if (validUntil == null) {
            return VALID;
        }
        LocalDate today = LocalDate.now();
        if (validUntil.isBefore(today)) {
            return EXPIRED;
        }
        if (ChronoUnit.DAYS.between(today, validUntil) <= 30) {
            return EXPIRING;
        }
        return VALID;
    }
}
