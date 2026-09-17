package kz.eco.protocol.docgen;

import kz.eco.protocol.ProtocolTemplateCode;

import java.util.List;
import java.util.Locale;

/**
 * Maps a protocol templateId to its real DOCX template file and results-table column set.
 * One entry per distinct Word form the laboratory actually uses.
 */
public enum ProtocolTemplateKey {

    SOIL("protocol_soil.docx", ResultColumnSet.SOIL),
    AMBIENT_AIR("protocol_ambient_air.docx", ResultColumnSet.GENERIC),
    WORKPLACE_AIR("protocol_workplace_air.docx", ResultColumnSet.GENERIC),
    WATER("protocol_water.docx", ResultColumnSet.GENERIC),
    MICROCLIMATE("protocol_microclimate.docx", ResultColumnSet.GENERIC),
    LIGHTING("protocol_lighting.docx", ResultColumnSet.GENERIC),
    NOISE_VIBRATION("protocol_noise_vibration.docx", ResultColumnSet.GENERIC),
    UV_EMF_LASER("protocol_physical_factors.docx", ResultColumnSet.GENERIC);

    public enum ResultColumnSet {
        /** Наименование продукции/объекта | показатели | НД | Нормативы (ПДК), не более | Результаты. */
        SOIL,
        /** Место отбора | показатели, ед.изм. | НД | Норма по НД | Результаты. */
        GENERIC
    }

    private final String fileName;
    private final ResultColumnSet columnSet;

    ProtocolTemplateKey(String fileName, ResultColumnSet columnSet) {
        this.fileName = fileName;
        this.columnSet = columnSet;
    }

    public String fileName() {
        return fileName;
    }

    public ResultColumnSet columnSet() {
        return columnSet;
    }

    public String classpathLocation() {
        return "templates/protocols/" + fileName;
    }

    /**
     * templateId is the API id (soil, ambient_air, workplace_air, water_wastewater,
     * microclimate, lighting, noise_vibration) or a DB template code (SOIL, AMBIENT_AIR_SZZ, ...).
     */
    public static ProtocolTemplateKey fromTemplateId(String templateId) {
        if (templateId == null || templateId.isBlank()) {
            return null;
        }
        String normalized = templateId.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (normalized) {
            case "soil" -> SOIL;
            case "ambient_air", "ambient_air_szz", "atmospheric_air", "industrial_emissions" -> AMBIENT_AIR;
            case "workplace_air", "work_zone_air" -> WORKPLACE_AIR;
            case "water_wastewater", "water" -> WATER;
            case "microclimate" -> MICROCLIMATE;
            case "lighting" -> LIGHTING;
            case "noise_vibration" -> NOISE_VIBRATION;
            case "uv_emf_laser" -> UV_EMF_LASER;
            default -> fromProtocolTemplateCode(ProtocolTemplateCode.fromDbCode(templateId));
        };
    }

    private static ProtocolTemplateKey fromProtocolTemplateCode(ProtocolTemplateCode code) {
        if (code == null) {
            return null;
        }
        return switch (code) {
            case SOIL -> ProtocolTemplateKey.SOIL;
            case AMBIENT_AIR_SZZ, INDUSTRIAL_EMISSIONS -> ProtocolTemplateKey.AMBIENT_AIR;
            case WORKPLACE_AIR -> ProtocolTemplateKey.WORKPLACE_AIR;
            case WATER_WASTEWATER -> ProtocolTemplateKey.WATER;
            case MICROCLIMATE -> ProtocolTemplateKey.MICROCLIMATE;
            case LIGHTING -> ProtocolTemplateKey.LIGHTING;
            case NOISE_VIBRATION -> ProtocolTemplateKey.NOISE_VIBRATION;
            case UV_EMF_LASER -> ProtocolTemplateKey.UV_EMF_LASER;
        };
    }

    public static List<ProtocolTemplateKey> all() {
        return List.of(values());
    }
}
