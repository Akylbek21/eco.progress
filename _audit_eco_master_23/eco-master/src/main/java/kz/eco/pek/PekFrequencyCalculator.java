package kz.eco.pek;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * How many times a {@link PekProgramControlItem} is due within a report's period (module spec §6:
 * plannedCount depends on frequencyType). Pure function, deliberately dependency-free so it can be
 * unit-tested without a Spring context (see PekFrequencyCalculatorTest) - this is exactly the
 * calculation the entity's own javadoc says was missing ("so plan/fact can compute plannedCount for
 * any report period").
 *
 * <p>An explicit {@code plannedCount} on the control item always wins - it means a human already
 * decided the number for this program (module spec: "plannedCount" is itself a stored, editable
 * field), and this calculator only fills the gap when nobody set it.
 */
public final class PekFrequencyCalculator {

    private PekFrequencyCalculator() {
    }

    public static int plannedOccurrences(PekFrequencyType frequencyType, int frequencyValue,
                                   Integer explicitPlannedCount, LocalDate periodStart, LocalDate periodEnd) {
        if (explicitPlannedCount != null) {
            return Math.max(0, explicitPlannedCount);
        }
        if (frequencyType == null || periodStart == null || periodEnd == null || periodEnd.isBefore(periodStart)) {
            return 0;
        }
        int multiplier = frequencyValue > 0 ? frequencyValue : 1;
        long days = ChronoUnit.DAYS.between(periodStart, periodEnd) + 1;

        return switch (frequencyType) {
            case DAILY -> (int) days * multiplier;
            case WEEKLY -> (int) Math.ceil(days / 7.0) * multiplier;
            case MONTHLY -> (int) (ChronoUnit.MONTHS.between(periodStart.withDayOfMonth(1), periodEnd.withDayOfMonth(1)) + 1) * multiplier;
            // A control item due QUARTERLY is satisfied once per quarter of the report's period -
            // a QUARTER report covers exactly one quarter (1 occurrence); a YEAR report covers 4.
            case QUARTERLY -> quartersSpanned(periodStart, periodEnd) * multiplier;
            case SEMIANNUAL -> Math.max(1, quartersSpanned(periodStart, periodEnd) / 2) * multiplier;
            // Only due within a period that actually spans a full year (a YEAR report, or a custom
            // period of 12+ months) - never forced due inside a single quarterly report.
            case ANNUAL -> (days >= 365 ? 1 : 0) * multiplier;
            // Event-driven, not calendar-driven - with no explicit plannedCount there is nothing
            // this calculator can honestly derive, so it reports 0 rather than guessing.
            case PER_EVENT -> 0;
        };
    }

    private static int quartersSpanned(LocalDate periodStart, LocalDate periodEnd) {
        long months = ChronoUnit.MONTHS.between(periodStart.withDayOfMonth(1), periodEnd.withDayOfMonth(1)) + 1;
        return Math.max(1, (int) Math.round(months / 3.0));
    }
}
