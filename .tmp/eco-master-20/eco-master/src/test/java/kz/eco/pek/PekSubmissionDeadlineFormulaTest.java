package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
import kz.eco.company.SpecialMonitoringType;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ПЭК submission deadlines under п.23 as amended in 2026: calendar rules resolved from
 * (reportType, regulationCode), never a fixed day count and never derived from periodType alone.
 */
class PekSubmissionDeadlineFormulaTest {

    private final PekSubmissionDeadlineService service = new PekSubmissionDeadlineService();
    private static final String EDITION = PekRegulationVersionService.PEK_RULES_250_2026_59;

    private LocalDate quarterly(LocalDate periodEnd) {
        return service.calculate(PekReportType.PEK_QUARTERLY, EDITION, periodEnd);
    }

    @Test
    void quarterlyIsFirstDayOfSecondMonthAfterTheQuarter() {
        assertEquals(LocalDate.of(2026, 5, 1), quarterly(LocalDate.of(2026, 3, 31)));
        assertEquals(LocalDate.of(2026, 8, 1), quarterly(LocalDate.of(2026, 6, 30)));
        assertEquals(LocalDate.of(2026, 11, 1), quarterly(LocalDate.of(2026, 9, 30)));
        assertEquals(LocalDate.of(2027, 2, 1), quarterly(LocalDate.of(2026, 12, 31)));
    }

    @Test
    void q4RollsIntoTheNextYear() {
        assertEquals(2027, quarterly(LocalDate.of(2026, 12, 31)).getYear());
    }

    @Test
    void annualTables7And12AreDueFirstDayOfThirdMonthAfterThePeriod() {
        assertEquals(LocalDate.of(2027, 3, 1), service.calculate(
                PekReportType.PEK_TABLES_7_12_ANNUAL, EDITION, LocalDate.of(2026, 12, 31)));
    }

    @Test
    void caspianAnnualIsDueFirstDayOfThirdMonthAfterThePeriod() {
        assertEquals(LocalDate.of(2027, 3, 1), service.calculate(
                PekReportType.PEM_CASPIAN_ANNUAL, EDITION, LocalDate.of(2026, 12, 31)));
    }

    @Test
    void theTwoAnnualObligationsStayDistinctRulesEvenThoughTheyLandOnTheSameDay() {
        LocalDate yearEnd = LocalDate.of(2026, 12, 31);
        assertEquals(service.calculate(PekReportType.PEK_TABLES_7_12_ANNUAL, EDITION, yearEnd),
                service.calculate(PekReportType.PEM_CASPIAN_ANNUAL, EDITION, yearEnd));
        assertNotEquals(
                service.findRule(PekReportType.PEK_TABLES_7_12_ANNUAL, EDITION).orElseThrow(),
                service.findRule(PekReportType.PEM_CASPIAN_ANNUAL, EDITION).orElseThrow());
    }

    @Test
    void everyRuleIsACalendarRule_noFixedDayOffsetSurvives() {
        // The old design applied periodEnd.plusDays(45) to every annual report - a rule the
        // regulation does not state, and one that drifts with month length.
        LocalDate yearEnd = LocalDate.of(2026, 12, 31);
        assertNotEquals(yearEnd.plusDays(45),
                service.calculate(PekReportType.PEK_TABLES_7_12_ANNUAL, EDITION, yearEnd));
        assertNotEquals(yearEnd.plusDays(45),
                service.calculate(PekReportType.PEM_CASPIAN_ANNUAL, EDITION, yearEnd));
        assertTrue(service.rules().stream().allMatch(r -> r.monthsAfterPeriodEnd() > 0));
        for (LocalDate end : new LocalDate[]{
                LocalDate.of(2026, 3, 31), LocalDate.of(2026, 6, 30),
                LocalDate.of(2026, 9, 30), LocalDate.of(2026, 12, 31), LocalDate.of(2024, 2, 29)}) {
            assertEquals(1, quarterly(end).getDayOfMonth(), "не календарное правило для " + end);
        }
    }

    @Test
    void thereIsNoGenericAnnualPekReportType() {
        assertTrue(Arrays.stream(PekReportType.values()).noneMatch(t -> t.name().equals("PEK_ANNUAL")),
                "правила не устанавливают срок для годового отчёта ПЭК как такового");
    }

    // ---- Caspian applicability -------------------------------------------------------------------

    @Test
    void caspianTypeIsAvailableOnlyToAMarkedFacility() {
        assertTrue(PekReportType.PEM_CASPIAN_ANNUAL.isAvailableFor(SpecialMonitoringType.CASPIAN_MARINE));
        assertFalse(PekReportType.PEM_CASPIAN_ANNUAL.isAvailableFor(SpecialMonitoringType.NONE));
        assertTrue(PekReportType.PEK_QUARTERLY.isAvailableFor(SpecialMonitoringType.NONE));
        assertTrue(PekReportType.PEK_TABLES_7_12_ANNUAL.isAvailableFor(SpecialMonitoringType.NONE));
    }

    @Test
    void classificationUsesTheFacilityFlag_notThePeriodAlone() {
        assertEquals(PekReportType.PEK_QUARTERLY,
                PekReportType.classify(PekPeriodType.QUARTER, SpecialMonitoringType.CASPIAN_MARINE));
        assertEquals(PekReportType.PEK_TABLES_7_12_ANNUAL,
                PekReportType.classify(PekPeriodType.YEAR, SpecialMonitoringType.NONE));
        assertEquals(PekReportType.PEM_CASPIAN_ANNUAL,
                PekReportType.classify(PekPeriodType.YEAR, SpecialMonitoringType.CASPIAN_MARINE));
        // An unmarked facility never drifts into the later Caspian deadline.
        assertEquals(PekReportType.PEK_TABLES_7_12_ANNUAL,
                PekReportType.classify(PekPeriodType.YEAR, null));
    }

    @Test
    void caspianDeadlineIsRefusedForAnUnmarkedFacility() {
        ConflictException e = assertThrows(ConflictException.class, () -> service.calculateFor(
                PekReportType.PEM_CASPIAN_ANNUAL, SpecialMonitoringType.NONE,
                EDITION, LocalDate.of(2026, 12, 31)));
        assertTrue(e.getMessage().contains("CASPIAN_MARINE"));

        assertEquals(LocalDate.of(2027, 3, 1), service.calculateFor(
                PekReportType.PEM_CASPIAN_ANNUAL, SpecialMonitoringType.CASPIAN_MARINE,
                EDITION, LocalDate.of(2026, 12, 31)));
    }

    // ---- edition keying ---------------------------------------------------------------------------

    @Test
    void everyReportTypeHasARuleUnderEveryKnownEdition() {
        for (PekReportType type : PekReportType.values()) {
            assertTrue(service.findRule(type, PekRegulationVersionService.PEK_RULES_250_2026_59).isPresent(),
                    "нет правила для " + type + " в редакции 2026 года");
            assertTrue(service.findRule(type, PekRegulationVersionService.PEK_RULES_250_2021).isPresent(),
                    "нет правила для " + type + " в базовой редакции");
        }
    }

    @Test
    void unknownEditionIsRejectedRatherThanSilentlyDefaulted() {
        assertThrows(RuntimeException.class, () -> service.calculate(
                PekReportType.PEK_QUARTERLY, "PR250_2023", LocalDate.of(2026, 3, 31)));
    }

    @Test
    void nullPeriodEndYieldsNoDeadline() {
        assertNull(service.calculate(PekReportType.PEK_QUARTERLY, EDITION, null));
    }
}
