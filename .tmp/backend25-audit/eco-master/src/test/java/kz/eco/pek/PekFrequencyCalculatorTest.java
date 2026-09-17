package kz.eco.pek;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Pure logic, no Spring context - the calculation PekFrequencyType's own javadoc says plan/fact
 *  was missing (module spec §6). */
class PekFrequencyCalculatorTest {

    @Test
    void explicitPlannedCount_alwaysWins() {
        assertEquals(7, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.DAILY, 1, 7, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));
    }

    @Test
    void quarterly_oneQuarterPeriod_isOneOccurrence() {
        assertEquals(1, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.QUARTERLY, 1, null, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30)));
    }

    @Test
    void quarterly_fullYearPeriod_isFourOccurrences() {
        assertEquals(4, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.QUARTERLY, 1, null, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));
    }

    @Test
    void quarterly_withFrequencyValueTwo_doublesOccurrences() {
        assertEquals(2, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.QUARTERLY, 2, null, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30)));
    }

    @Test
    void monthly_threeMonthQuarter_isThreeOccurrences() {
        assertEquals(3, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.MONTHLY, 1, null, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30)));
    }

    @Test
    void annual_quarterlyReport_isNeverDue() {
        assertEquals(0, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.ANNUAL, 1, null, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30)));
    }

    @Test
    void annual_fullYearReport_isOneOccurrence() {
        assertEquals(1, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.ANNUAL, 1, null, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));
    }

    @Test
    void perEvent_withNoExplicitCount_isHonestlyZero_notGuessed() {
        assertEquals(0, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.PER_EVENT, 1, null, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));
    }

    @Test
    void invalidPeriod_isZero() {
        assertEquals(0, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.DAILY, 1, null, LocalDate.of(2026, 6, 30), LocalDate.of(2026, 1, 1)));
    }

    @Test
    void weekly_oneQuarter_isThirteenOccurrences() {
        // 91 days / 7 = 13 exactly for this specific quarter.
        assertEquals(13, PekFrequencyCalculator.plannedOccurrences(
                PekFrequencyType.WEEKLY, 1, null, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30)));
    }
}
