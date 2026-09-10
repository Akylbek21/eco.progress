package kz.eco.pek;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The regulation reference book carries the real citations, and the incorrect one it used to carry
 * is gone from every path that can reach a generated document's "Нормативная основа" header.
 */
class PekRegulationVersionRegistryTest {

    private final PekRegulationVersionService service =
            new PekRegulationVersionService(PekRegulationVersionService.PEK_RULES_250_2026_59);

    @Test
    void baseEditionCitesTheOrderThatActuallyApprovedTheRules() {
        PekRegulationVersion base = service.require(PekRegulationVersionService.PEK_RULES_250_2021);
        assertTrue(base.baseOrder().contains("14.07.2021"));
        assertTrue(base.baseOrder().contains("№250"));
        assertTrue(base.baseOrder().contains("23553"), "должна быть указана регистрация в Минюсте");
        assertNull(base.revisionOrder(), "базовая редакция - не изменение");
        assertEquals(LocalDate.of(2021, 7, 14), base.effectiveFrom());
    }

    @Test
    void amendmentEditionCitesOrder59AndItsEffectiveDate() {
        PekRegulationVersion amended = service.require(PekRegulationVersionService.PEK_RULES_250_2026_59);
        assertNotNull(amended.revisionOrder());
        assertTrue(amended.revisionOrder().contains("30.03.2026"));
        assertTrue(amended.revisionOrder().contains("№59"));
        assertTrue(amended.revisionOrder().contains("38268"));
        assertEquals(LocalDate.of(2026, 4, 19), amended.effectiveFrom());
        // The base edition closes the day before the amendment takes effect - no gap, no overlap.
        assertEquals(amended.effectiveFrom().minusDays(1),
                service.require(PekRegulationVersionService.PEK_RULES_250_2021).effectiveTo());
    }

    @Test
    void theIncorrectCitationIsGoneEverywhere() {
        for (PekRegulationVersion e : service.all()) {
            assertFalse(e.citation().contains("26.05.2023"),
                    "неверная ссылка на приказ осталась в справочнике: " + e.citation());
        }
        assertFalse(PekRegulationVersionService.CURRENT.contains("26.05.2023"));
        assertThrows(RuntimeException.class, () -> service.require("PR250_2023"));
    }

    @Test
    void citationIncludesBothOrdersForAnAmendedEdition() {
        String citation = service.require(PekRegulationVersionService.PEK_RULES_250_2026_59).citation();
        assertTrue(citation.contains("14.07.2021"), "базовый приказ должен остаться в ссылке");
        assertTrue(citation.contains("№59"), "изменяющий приказ должен быть в ссылке");
        assertTrue(citation.contains("в редакции"));
    }

    @Test
    void effectivenessWindowsCoverTheAmendmentBoundary() {
        PekRegulationVersion base = service.require(PekRegulationVersionService.PEK_RULES_250_2021);
        PekRegulationVersion amended = service.require(PekRegulationVersionService.PEK_RULES_250_2026_59);

        assertTrue(base.isEffectiveOn(LocalDate.of(2026, 4, 18)));
        assertFalse(base.isEffectiveOn(LocalDate.of(2026, 4, 19)));
        assertFalse(amended.isEffectiveOn(LocalDate.of(2026, 4, 18)));
        assertTrue(amended.isEffectiveOn(LocalDate.of(2026, 4, 19)));
        assertTrue(amended.isEffectiveOn(LocalDate.of(2030, 1, 1)), "текущая редакция не закрыта");
    }

    @Test
    void newRowsAreStampedWithTheAmendedEdition() {
        assertEquals(PekRegulationVersionService.PEK_RULES_250_2026_59, service.currentCode());
        assertEquals("v2-2026", service.current().programTemplateVersion());
        assertEquals("v2-2026", service.current().reportTemplateVersion());
    }

    @Test
    void anEditionCodeOutsideTheBookIsRefusedAtStartup() {
        assertThrows(IllegalStateException.class,
                () -> new PekRegulationVersionService("PR250_2023"));
    }

    @Test
    void legacyRowsResolveToTheBaseEditionRatherThanTheLatestOne() {
        // A row stamped before the reference book existed must not be silently re-read as if it had
        // been authored under the amendment.
        assertEquals(PekRegulationVersionService.PEK_RULES_250_2021,
                service.resolve(null, "Правила №250 (Приказ МЭГПР РК от 26.05.2023 №250)").code());
        assertEquals(PekRegulationVersionService.PEK_RULES_250_2021, service.resolve(null, null).code());
        assertEquals(PekRegulationVersionService.PEK_RULES_250_2026_59,
                service.resolve(PekRegulationVersionService.PEK_RULES_250_2026_59, null).code());
    }
}
