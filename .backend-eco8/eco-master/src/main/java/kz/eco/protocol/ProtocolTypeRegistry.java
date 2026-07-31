package kz.eco.protocol;

import kz.eco.common.exception.BadRequestException;
import kz.eco.normative.SourceDocumentCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Single source of truth for what a protocol "type" means: which normative source it pulls
 * from, which Word template renders it, what unit it defaults to, and whether its measurements
 * are chemical (pollutant code driven) or physical (factor type/code driven). The frontend only
 * ever sends a templateId — everything else here is derived and validated, never trusted blindly
 * from the request body.
 */
public final class ProtocolTypeRegistry {

    private static final Logger log = LoggerFactory.getLogger(ProtocolTypeRegistry.class);

    /** The bare, ambiguous legacy bucket - never a valid final templateId on its own. */
    private static final String PHYSICAL_FACTORS_BUCKET = "physical_factors";

    private static final Map<String, ProtocolTypeConfig> BY_ID = build();

    private ProtocolTypeRegistry() {
    }

    private static Map<String, ProtocolTypeConfig> build() {
        Map<String, ProtocolTypeConfig> map = new LinkedHashMap<>();
        map.put("ambient_air", config(
                "ambient_air", "Атмосферный воздух", SourceDocumentCode.DSM_70.name(),
                "protocol_ambient_air", "мг/м³", "ambient_air", ProtocolTypeConfig.ResultMode.CHEMICAL));
        map.put("workplace_air", config(
                "workplace_air", "Воздух рабочей зоны", SourceDocumentCode.DSM_70.name(),
                "protocol_workplace_air", "мг/м³", "workplace_air", ProtocolTypeConfig.ResultMode.CHEMICAL));
        map.put("soil", config(
                "soil", "Почва", SourceDocumentCode.DSM_32.name(),
                "protocol_soil", "мг/кг", "soil", ProtocolTypeConfig.ResultMode.CHEMICAL));
        map.put("water", config(
                "water", "Вода", SourceDocumentCode.DSM_138.name(),
                "protocol_water", "мг/дм³", "water_wastewater", ProtocolTypeConfig.ResultMode.CHEMICAL));
        map.put("microclimate", config(
                "microclimate", "Микроклимат", SourceDocumentCode.DSM_15.name(),
                "protocol_microclimate", null, "physical_factors", ProtocolTypeConfig.ResultMode.PHYSICAL));
        map.put("lighting", config(
                "lighting", "Освещенность", SourceDocumentCode.DSM_15.name(),
                "protocol_lighting", "лк", "physical_factors", ProtocolTypeConfig.ResultMode.PHYSICAL));
        map.put("noise_vibration", config(
                "noise_vibration", "Шум / вибрация", SourceDocumentCode.DSM_15.name(),
                "protocol_noise_vibration", "дБА", "physical_factors", ProtocolTypeConfig.ResultMode.PHYSICAL));
        map.put("uv_emf_laser", config(
                "uv_emf_laser", "УФ / ЭМП / Лазер", SourceDocumentCode.DSM_15.name(),
                "protocol_physical_factors", null, "physical_factors", ProtocolTypeConfig.ResultMode.PHYSICAL));
        return Map.copyOf(map);
    }

    /**
     * Builds one entry, checking at class-init time that its DOCX template actually exists on
     * the classpath. A type without a template is kept in the registry (so lookups by id still
     * work and give a clear error) but marked inactive, and {@link #findActive()} - what
     * GET /api/protocols/templates uses - excludes it.
     */
    private static ProtocolTypeConfig config(String templateId, String title, String sourceDocumentCode,
                                              String docxTemplateCode, String defaultUnit,
                                              String normativeTemplateId, ProtocolTypeConfig.ResultMode resultMode) {
        String resourcePath = "templates/protocols/" + docxTemplateCode + ".docx";
        boolean templateExists = ProtocolTypeRegistry.class.getClassLoader().getResource(resourcePath) != null;
        if (!templateExists) {
            log.warn("Protocol template resource not found: {}", docxTemplateCode);
        }
        return new ProtocolTypeConfig(templateId, title, sourceDocumentCode, docxTemplateCode, defaultUnit,
                normativeTemplateId, resultMode, templateExists);
    }

    /**
     * Resolves a raw templateId (canonical or legacy alias) to its config, or null if unknown.
     * The bare legacy bucket "physical_factors" is deliberately NOT resolved here - it is
     * ambiguous between microclimate/lighting/noise_vibration/uv_emf_laser, so silently
     * defaulting it to microclimate would misfile new protocols. Callers that may legitimately
     * receive that legacy value (with a disambiguating subtype) must use
     * {@link #resolve(String, String)} instead.
     */
    public static ProtocolTypeConfig resolve(String rawTemplateId) {
        String canonicalId = canonicalId(rawTemplateId);
        return canonicalId != null ? BY_ID.get(canonicalId) : null;
    }

    /**
     * Same as {@link #resolve(String)}, but additionally accepts the legacy "physical_factors"
     * bucket if - and only if - {@code subtype} unambiguously names one of MICROCLIMATE /
     * LIGHTING / NOISE_VIBRATION / UV_EMF_LASER. Missing or unrecognised subtype for that bucket
     * is a 400, never an automatic choice of microclimate.
     */
    public static ProtocolTypeConfig resolve(String rawTemplateId, String subtype) {
        String canonicalId = canonicalId(rawTemplateId);
        if (canonicalId != null) {
            return BY_ID.get(canonicalId);
        }
        if (rawTemplateId != null && normalize(rawTemplateId).equals(PHYSICAL_FACTORS_BUCKET)) {
            return BY_ID.get(resolvePhysicalFactorsSubtype(subtype));
        }
        return null;
    }

    private static String resolvePhysicalFactorsSubtype(String subtype) {
        if (subtype == null || subtype.isBlank()) {
            throw new BadRequestException(
                    "templateId=physical_factors требует однозначный subtype "
                            + "(MICROCLIMATE, LIGHTING, NOISE_VIBRATION или UV_EMF_LASER)");
        }
        String normalizedSubtype = normalize(subtype);
        return switch (normalizedSubtype) {
            case "microclimate" -> "microclimate";
            case "lighting" -> "lighting";
            case "noise_vibration" -> "noise_vibration";
            case "uv_emf_laser" -> "uv_emf_laser";
            default -> throw new BadRequestException(
                    "Неизвестный subtype для templateId=physical_factors: " + subtype);
        };
    }

    private static String canonicalId(String rawTemplateId) {
        if (rawTemplateId == null || rawTemplateId.isBlank()) {
            return null;
        }
        String normalized = normalize(rawTemplateId);
        return switch (normalized) {
            case "ambient_air", "ambient_air_szz", "atmospheric_air", "industrial_emissions" -> "ambient_air";
            case "workplace_air", "work_zone_air" -> "workplace_air";
            case "soil" -> "soil";
            case "water", "water_wastewater" -> "water";
            case "microclimate" -> "microclimate";
            case "lighting" -> "lighting";
            case "noise_vibration" -> "noise_vibration";
            case "uv_emf_laser" -> "uv_emf_laser";
            default -> null;
        };
    }

    private static String normalize(String raw) {
        return raw.trim().toLowerCase(Locale.ROOT).replace('-', '_');
    }

    public static ProtocolTypeConfig require(String rawTemplateId) {
        ProtocolTypeConfig config = resolve(rawTemplateId);
        if (config == null) {
            throw new BadRequestException("Неизвестный templateId: " + rawTemplateId);
        }
        return config;
    }

    /** Same as {@link #require(String)}, but resolves the legacy physical_factors+subtype pair. */
    public static ProtocolTypeConfig require(String rawTemplateId, String subtype) {
        ProtocolTypeConfig config = resolve(rawTemplateId, subtype);
        if (config == null) {
            throw new BadRequestException("Неизвестный templateId: " + rawTemplateId);
        }
        return config;
    }

    /** Optional-returning lookup for callers that want to branch on presence rather than catch. */
    public static Optional<ProtocolTypeConfig> find(String templateId) {
        return Optional.ofNullable(resolve(templateId));
    }

    public static boolean supports(String templateId) {
        return resolve(templateId) != null;
    }

    /** Types the backend can actually create AND generate documents for right now - what
     * GET /api/protocols/templates returns. */
    public static List<ProtocolTypeConfig> findActive() {
        return BY_ID.values().stream().filter(ProtocolTypeConfig::active).toList();
    }

    /**
     * Validates that any sourceDocumentCode/docxTemplateCode the client sent (both optional,
     * both purely informational) actually match what the templateId resolves to. The frontend
     * must never be allowed to pick a mismatched DSM source or Word template.
     */
    public static void validateConsistency(ProtocolTypeConfig config, String requestedSourceDocumentCode,
                                           String requestedDocxTemplateCode) {
        if (requestedSourceDocumentCode != null && !requestedSourceDocumentCode.isBlank()
                && !equalsIgnoreCaseNormalized(requestedSourceDocumentCode, config.sourceDocumentCode())) {
            throw new BadRequestException("Источник нормативов не соответствует типу протокола");
        }
        if (requestedDocxTemplateCode != null && !requestedDocxTemplateCode.isBlank()
                && !equalsIgnoreCaseNormalized(requestedDocxTemplateCode, config.docxTemplateCode())) {
            throw new BadRequestException("Шаблон печати не соответствует типу протокола");
        }
    }

    private static boolean equalsIgnoreCaseNormalized(String requested, String expected) {
        if (expected == null) {
            return false;
        }
        return expected.equalsIgnoreCase(requested.trim());
    }

    public static Map<String, ProtocolTypeConfig> all() {
        return BY_ID;
    }
}
