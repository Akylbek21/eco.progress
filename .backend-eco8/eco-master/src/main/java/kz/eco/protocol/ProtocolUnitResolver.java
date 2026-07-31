package kz.eco.protocol;

import java.util.Locale;
import java.util.Map;

/**
 * Recovers a measurement's unit when the client didn't send one: first by the physical
 * factor's code (temperature is always °C regardless of protocol type), then by the
 * protocol type's own default unit (chemical protocols mostly have one fixed unit).
 * If both come up empty, quick-create must reject the row rather than persist a blank unit.
 */
public final class ProtocolUnitResolver {

    private static final Map<String, String> FACTOR_CODE_UNITS = Map.ofEntries(
            Map.entry("AIR_TEMPERATURE", "°C"),
            Map.entry("HUMIDITY", "%"),
            Map.entry("AIR_SPEED", "м/с"),
            Map.entry("NOISE", "дБА"),
            Map.entry("LIGHTING", "лк"),
            Map.entry("VIBRATION", "дБ"),
            Map.entry("UV_A", "Вт/м²"),
            Map.entry("UV_B", "Вт/м²"),
            Map.entry("UV_C", "Вт/м²")
    );

    private ProtocolUnitResolver() {
    }

    public static String resolve(String providedUnit, ProtocolTypeConfig config, String factorCode) {
        if (providedUnit != null && !providedUnit.isBlank()) {
            return providedUnit.trim();
        }
        if (factorCode != null && !factorCode.isBlank()) {
            String byFactor = FACTOR_CODE_UNITS.get(factorCode.trim().toUpperCase(Locale.ROOT));
            if (byFactor != null) {
                return byFactor;
            }
        }
        return config != null ? config.defaultUnit() : null;
    }
}
