package kz.eco.normative;

import kz.eco.common.SearchTextUtils;
import kz.eco.protocol.PhysicalFactorSubtype;
import kz.eco.protocol.ProtocolTemplateCode;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class PhysicalFactorCatalog {

    public record FactorEntry(
            String code,
            String nameRu,
            String nameKz,
            String unit,
            PhysicalFactorSubtype subtype
    ) {}

    private static final List<FactorEntry> ENTRIES = List.of(
            entry("LIGHTING", "Освещённость", "Жарықтандыру", "лк", PhysicalFactorSubtype.LIGHTING),
            entry("KEO", "Коэффициент естественной освещённости", "Жаратылым жарықтандыру коэффициенті", "%", PhysicalFactorSubtype.LIGHTING),
            entry("LIGHT_PULSATION", "Пульсация освещённости", "Жарықтандыру пульсациясы", "%", PhysicalFactorSubtype.LIGHTING),
            entry("AIR_TEMPERATURE", "Температура воздуха", "Ауа температурасы", "°C", PhysicalFactorSubtype.MICROCLIMATE),
            entry("HUMIDITY", "Относительная влажность", "Салыстырмалы ылғалдылық", "%", PhysicalFactorSubtype.MICROCLIMATE),
            entry("AIR_SPEED", "Скорость движения воздуха", "Ауа қозғалысының жылдамдығы", "м/с", PhysicalFactorSubtype.MICROCLIMATE),
            entry("NOISE_LEVEL", "Уровень шума", "Шу деңгейі", "дБА", PhysicalFactorSubtype.NOISE),
            entry("NOISE_EQUIVALENT", "Эквивалентный уровень шума", "Эквивалентті шу деңгейі", "дБА", PhysicalFactorSubtype.NOISE),
            entry("NOISE_MAX", "Максимальный уровень шума", "Максималды шу деңгейі", "дБА", PhysicalFactorSubtype.NOISE),
            entry("VIBRATION", "Вибрация", "Дбру", "дБ", PhysicalFactorSubtype.VIBRATION),
            entry("VIBRATION_SPEED", "Виброскорость", "Дбру жылдамдығы", "м/с", PhysicalFactorSubtype.VIBRATION),
            entry("VIBRATION_ACCELERATION", "Виброускорение", "Дбру үдеуі", "м/с²", PhysicalFactorSubtype.VIBRATION)
    );

    private PhysicalFactorCatalog() {
    }

    public static List<FactorEntry> all() {
        return ENTRIES;
    }

    public static List<FactorEntry> search(String query, String subtypeRaw) {
        List<FactorEntry> pool = poolForSubtype(parseSubtype(subtypeRaw));
        String q = SearchTextUtils.normalizeText(query);
        if (q.isEmpty()) {
            return pool.stream().limit(20).toList();
        }

        List<FactorEntry> whole = searchToken(pool, q);
        if (!whole.isEmpty()) {
            return whole.stream().limit(20).toList();
        }

        Set<FactorEntry> matches = new LinkedHashSet<>();
        for (String token : SearchTextUtils.searchTokens(query)) {
            if (token.isBlank()) {
                continue;
            }
            String normalizedToken = SearchTextUtils.normalizeText(token);
            if (normalizedToken.isEmpty()) {
                continue;
            }
            matches.addAll(searchToken(pool, normalizedToken));
        }
        return matches.stream().limit(20).toList();
    }

    private static List<FactorEntry> poolForSubtype(PhysicalFactorSubtype subtype) {
        if (subtype == PhysicalFactorSubtype.NOISE_VIBRATION) {
            return ENTRIES.stream()
                    .filter(e -> e.subtype() == PhysicalFactorSubtype.NOISE || e.subtype() == PhysicalFactorSubtype.VIBRATION)
                    .toList();
        }
        if (subtype != null) {
            return ENTRIES.stream().filter(e -> e.subtype() == subtype).toList();
        }
        return ENTRIES;
    }

    private static List<FactorEntry> searchToken(List<FactorEntry> pool, String query) {
        List<FactorEntry> matches = new ArrayList<>();
        for (FactorEntry entry : pool) {
            if (matches(entry, query)) {
                matches.add(entry);
            }
        }
        return matches;
    }

    public static PhysicalFactorSubtype parseSubtype(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return PhysicalFactorSubtype.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static boolean matches(FactorEntry entry, String query) {
        return contains(entry.code(), query)
                || contains(entry.nameRu(), query)
                || contains(entry.nameKz(), query);
    }

    private static boolean contains(String value, String query) {
        return value != null && SearchTextUtils.normalizeText(value).contains(query);
    }

    private static FactorEntry entry(String code, String nameRu, String nameKz, String unit, PhysicalFactorSubtype subtype) {
        return new FactorEntry(code, nameRu, nameKz, unit, subtype);
    }

    public static boolean isPhysicalFactorsTemplate(String templateId) {
        if (templateId == null || templateId.isBlank()) {
            return false;
        }
        ProtocolTemplateCode code = ProtocolTemplateCode.fromApi(templateId);
        if (code == null) {
            code = ProtocolTemplateCode.fromDbCode(templateId);
        }
        return code != null && code.isPhysicalFactor();
    }
}
