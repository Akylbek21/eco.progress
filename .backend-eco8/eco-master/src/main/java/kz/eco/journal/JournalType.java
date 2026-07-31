package kz.eco.journal;

import kz.eco.common.exception.BadRequestException;

import java.util.Locale;
import java.util.Map;

/** Canonical journal type codes. {@link #fromCode} accepts the pre-rename codes as aliases for
 *  backward compatibility, but every API response only ever emits the canonical name (see
 *  {@link #name()}). Renaming is code/title only - the column schema for each type is unchanged. */
public enum JournalType {
    ENVIRONMENT_CONDITIONS,
    CHEMICAL_REAGENT_USAGE,
    TEST_RESULTS_REGISTRATION,
    SAMPLE_REGISTRATION,
    SOLUTION_PREPARATION;

    private static final Map<String, JournalType> ALIASES = Map.of(
            "WATER_ANALYTICAL_CONTROL", ENVIRONMENT_CONDITIONS,
            "TEST_PROTOCOL_REGISTRATION", TEST_RESULTS_REGISTRATION,
            "INTRODUCTORY_BRIEFING", SAMPLE_REGISTRATION,
            "REAGENT_PREPARATION", SOLUTION_PREPARATION
    );

    public static JournalType fromCode(String code) {
        if (code == null || code.isBlank()) {
            throw new BadRequestException("Укажите journalType");
        }
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        JournalType alias = ALIASES.get(normalized);
        if (alias != null) {
            return alias;
        }
        try {
            return JournalType.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Неизвестный тип журнала: " + code);
        }
    }
}
