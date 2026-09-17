package kz.eco.pek;

import java.time.LocalDate;

/**
 * A single statutory submission-deadline rule: "for report type X under regulation edition Y, the
 * deadline is the first day of the N-th month following the reporting period".
 *
 * <p>Deliberately expressed as a CALENDAR rule (month offset, snap to day 1) rather than a day
 * count. A day count drifts with month length and leap years and would produce e.g. 30.04 instead
 * of 01.05 - see {@link PekSubmissionDeadlineService} for the rule table.
 */
public record PekSubmissionDeadlineRule(
        PekReportType reportType,
        String regulationCode,
        int monthsAfterPeriodEnd,
        String description
) {

    public LocalDate deadlineFor(LocalDate periodEnd) {
        return periodEnd == null ? null
                : periodEnd.plusMonths(monthsAfterPeriodEnd).withDayOfMonth(1);
    }
}
