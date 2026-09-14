package kz.eco.protocol;

import java.util.Locale;

public enum ProtocolTemplateCode {
    AMBIENT_AIR_SZZ("Атмосферный воздух / СЗЗ", "VRZ", "Ф 03-ДП-ИЛ-14"),
    INDUSTRIAL_EMISSIONS("Промышленные выбросы", "VPR", "Ф 01-ДП-ИЛ-14"),
    WATER_WASTEWATER("Вода / сточная вода", "VDW", "Ф 02-ДП-ИЛ-14"),
    SOIL("Почва", "SOL", "Ф 05-ДП-ИЛ-14"),
    MICROCLIMATE("Микроклимат", "PHF", "Ф 04-ДП-ИЛ-14"),
    LIGHTING("Освещённость", "LGT", "Ф 04-ДП-ИЛ-14"),
    NOISE_VIBRATION("Шум / вибрация", "NVB", "Ф 04-ДП-ИЛ-14"),
    WORKPLACE_AIR("Воздух рабочей зоны", "VRW", "Ф 06-ДП-ИЛ-14"),
    UV_EMF_LASER("УФ / ЭМП / Лазер", "UVL", "Ф 04-ДП-ИЛ-14");

    private final String title;
    private final String numberPrefix;
    private final String formCode;

    ProtocolTemplateCode(String title, String numberPrefix, String formCode) {
        this.title = title;
        this.numberPrefix = numberPrefix;
        this.formCode = formCode;
    }

    public String title() { return title; }
    public String numberPrefix() { return numberPrefix; }
    public String formCode() { return formCode; }

    /**
     * Always returns one of the 8 canonical ids (ambient_air, workplace_air, soil, water,
     * microclimate, lighting, noise_vibration, uv_emf_laser) - GET /templates and GET /{id} must
     * agree on the same templateId for the same protocol, and neither may ever leak an internal
     * DB-code spelling like "ambient_air_szz"/"water_wastewater" to a client (those remain valid
     * as legacy input aliases only - see fromNormalized). INDUSTRIAL_EMISSIONS has no canonical
     * counterpart among the 8 (it predates that list and isn't part of ProtocolTypeRegistry's
     * active set) - it is deliberately left unmapped here since remapping it to an unrelated
     * canonical id would misrepresent old data; it is a known, disclosed remaining gap.
     */
    public String toApiId() {
        return switch (this) {
            case AMBIENT_AIR_SZZ -> "ambient_air";
            case INDUSTRIAL_EMISSIONS -> "industrial_emissions";
            case WATER_WASTEWATER -> "water";
            case SOIL -> "soil";
            case MICROCLIMATE -> "microclimate";
            case LIGHTING -> "lighting";
            case NOISE_VIBRATION -> "noise_vibration";
            case WORKPLACE_AIR -> "workplace_air";
            case UV_EMF_LASER -> "uv_emf_laser";
        };
    }

    public static ProtocolTemplateCode fromApi(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return fromNormalized(raw.trim().toLowerCase(Locale.ROOT).replace('-', '_'));
    }

    public static ProtocolTemplateCode fromCode(String raw) {
        return fromCode(raw, null);
    }

    /**
     * "physical_factors" is deliberately NOT resolvable on its own (it used to silently collapse
     * to MICROCLIMATE, which meant a protocol requested for lighting or noise/vibration was
     * created as a microclimate protocol) - the caller must supply {@code subtype} to disambiguate
     * which physical-factor template was actually meant. Every other templateId is unaffected and
     * resolves exactly as before regardless of subtype.
     */
    public static ProtocolTemplateCode fromCode(String raw, String subtype) {
        if (raw == null || raw.isBlank()) {
            throw new kz.eco.common.exception.BadRequestException("Неизвестный templateId: " + raw);
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        if ("physical_factors".equals(normalized)) {
            return fromPhysicalFactorSubtype(subtype);
        }
        ProtocolTemplateCode mapped = fromApi(raw);
        if (mapped != null) {
            return mapped;
        }
        try {
            return ProtocolTemplateCode.valueOf(raw.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw new kz.eco.common.exception.BadRequestException("Неизвестный templateId: " + raw);
        }
    }

    private static ProtocolTemplateCode fromPhysicalFactorSubtype(String subtype) {
        if (subtype == null || subtype.isBlank()) {
            throw new kz.eco.common.exception.BadRequestException(
                    "Для физических факторов укажите subtype: microclimate, lighting, noise_vibration");
        }
        String normalizedSubtype = subtype.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (normalizedSubtype) {
            case "microclimate" -> MICROCLIMATE;
            case "lighting" -> LIGHTING;
            case "noise_vibration" -> NOISE_VIBRATION;
            default -> throw new kz.eco.common.exception.BadRequestException(
                    "Неизвестный subtype физических факторов: " + subtype
                            + ". Поддерживаются microclimate, lighting, noise_vibration");
        };
    }

    public static ProtocolTemplateCode fromDbCode(String dbCode) {
        if (dbCode == null || dbCode.isBlank()) {
            return null;
        }
        String normalized = dbCode.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "AMBIENT_AIR", "ATMOSPHERIC_AIR" -> AMBIENT_AIR_SZZ;
            case "PHYSICAL_FACTORS" -> MICROCLIMATE;
            default -> {
                try {
                    yield ProtocolTemplateCode.valueOf(normalized);
                } catch (IllegalArgumentException ex) {
                    yield fromApi(dbCode);
                }
            }
        };
    }

    public boolean isPhysicalFactor() {
        return this == MICROCLIMATE || this == LIGHTING || this == NOISE_VIBRATION || this == UV_EMF_LASER;
    }

    private static ProtocolTemplateCode fromNormalized(String normalized) {
        return switch (normalized) {
            case "ambient_air_szz", "ambient_air", "atmospheric_air" -> AMBIENT_AIR_SZZ;
            case "industrial_emissions" -> INDUSTRIAL_EMISSIONS;
            case "water_wastewater", "water" -> WATER_WASTEWATER;
            case "soil" -> SOIL;
            case "microclimate" -> MICROCLIMATE;
            case "lighting" -> LIGHTING;
            case "noise_vibration" -> NOISE_VIBRATION;
            // "physical_factors" is intentionally absent here - see fromCode(String, String):
            // it requires an explicit subtype and must never silently resolve to a guess.
            case "workplace_air", "work_zone_air" -> WORKPLACE_AIR;
            case "uv_emf_laser" -> UV_EMF_LASER;
            default -> null;
        };
    }
}
