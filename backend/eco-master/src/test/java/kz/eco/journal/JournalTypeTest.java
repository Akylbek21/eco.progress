package kz.eco.journal;

import kz.eco.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JournalTypeTest {

    @Test
    void fromCode_acceptsCanonicalNames() {
        for (JournalType type : JournalType.values()) {
            assertEquals(type, JournalType.fromCode(type.name()));
        }
    }

    @Test
    void fromCode_legacyAliasesResolveToCanonicalCodes() {
        assertEquals(JournalType.ENVIRONMENT_CONDITIONS, JournalType.fromCode("WATER_ANALYTICAL_CONTROL"));
        assertEquals(JournalType.TEST_RESULTS_REGISTRATION, JournalType.fromCode("TEST_PROTOCOL_REGISTRATION"));
        assertEquals(JournalType.SAMPLE_REGISTRATION, JournalType.fromCode("INTRODUCTORY_BRIEFING"));
        assertEquals(JournalType.SOLUTION_PREPARATION, JournalType.fromCode("REAGENT_PREPARATION"));
    }

    @Test
    void fromCode_isCaseInsensitive() {
        assertEquals(JournalType.SOLUTION_PREPARATION, JournalType.fromCode("reagent_preparation"));
    }

    @Test
    void fromCode_rejectsUnknownCode() {
        assertThrows(BadRequestException.class, () -> JournalType.fromCode("NOT_A_JOURNAL"));
    }

    @Test
    void fromCode_rejectsBlank() {
        assertThrows(BadRequestException.class, () -> JournalType.fromCode(""));
        assertThrows(BadRequestException.class, () -> JournalType.fromCode(null));
    }

    @Test
    void registry_everyTypeHasATitleAndColumnsWithKeyAndTitle() {
        for (JournalDefinition definition : JournalTypeRegistry.all()) {
            org.junit.jupiter.api.Assertions.assertNotNull(definition.title());
            org.junit.jupiter.api.Assertions.assertFalse(definition.title().isBlank());
            for (JournalColumn column : definition.columns()) {
                org.junit.jupiter.api.Assertions.assertNotNull(column.key());
                org.junit.jupiter.api.Assertions.assertFalse(column.key().isBlank());
                org.junit.jupiter.api.Assertions.assertNotNull(column.title());
                org.junit.jupiter.api.Assertions.assertFalse(column.title().isBlank());
            }
        }
    }
}
