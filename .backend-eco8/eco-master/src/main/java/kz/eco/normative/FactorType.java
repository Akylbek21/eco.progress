package kz.eco.normative;

import kz.eco.common.exception.ValidationException;

import java.util.Locale;
import java.util.Map;

/** Canonical physical-factor codes. {@link #fromApi} accepts the legacy aliases
 *  {@code ULTRAVIOLET}-&gt;{@code UV} and {@code EMF}-&gt;{@code ELECTROMAGNETIC_FIELD} for
 *  backward compatibility, but {@link #toApi()} (and every API response) only ever emits the
 *  canonical name. */
public enum FactorType {
    MICROCLIMATE,
    LIGHTING,
    NOISE,
    VIBRATION,
    NOISE_VIBRATION,
    INFRASOUND,
    ULTRASOUND,
    UV,
    AEROIONS,
    ELECTROMAGNETIC_FIELD,
    LASER;

    private static final Map<String, FactorType> ALIASES = Map.of(
            "ULTRAVIOLET", UV,
            "EMF", ELECTROMAGNETIC_FIELD
    );

    public static boolean isValid(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return ALIASES.containsKey(normalized) || hasName(normalized);
    }

    public static FactorType fromApi(String value) {
        if (value == null || value.isBlank()) {
            throw new ValidationException("Укажите factorType", Map.of("factorType", "Укажите factorType"));
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        FactorType alias = ALIASES.get(normalized);
        if (alias != null) {
            return alias;
        }
        try {
            return FactorType.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Неизвестный тип физического фактора: " + value,
                    Map.of("factorType", "Неизвестный тип физического фактора: " + value));
        }
    }

    public String toApi() {
        return name();
    }

    private static boolean hasName(String normalized) {
        for (FactorType type : values()) {
            if (type.name().equals(normalized)) {
                return true;
            }
        }
        return false;
    }
}
