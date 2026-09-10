package kz.eco.pek;

import kz.eco.company.SpecialMonitoringType;

/**
 * What statutory submission a {@link PekReport} is. This - not {@link PekPeriodType} - is what a
 * deadline is keyed on.
 *
 * <p>{@code periodType} answers "what stretch of time was measured". It cannot answer "when must
 * this be handed in": both annual types below cover a calendar year, and which one applies depends
 * on the facility, not on the period.
 *
 * <p>There is deliberately no generic "annual PEK report" type. The rules do not set an annual
 * deadline for the PEK report as a whole - what is filed annually is tables 7 and 12 of the form,
 * and, separately, the Caspian marine monitoring report.
 */
public enum PekReportType {

    /** Ordinary quarterly ПЭК report. */
    PEK_QUARTERLY(PekPeriodType.QUARTER),

    /** Annual submission of tables 7 and 12 of the ПЭК form. */
    PEK_TABLES_7_12_ANNUAL(PekPeriodType.YEAR),

    /**
     * Annual environmental monitoring report for the Kazakhstani sector of the Caspian Sea.
     * Available only for a facility explicitly marked
     * {@link SpecialMonitoringType#CASPIAN_MARINE} - never inferred from the period, coordinates or
     * КАТО.
     */
    PEM_CASPIAN_ANNUAL(PekPeriodType.YEAR);

    private final PekPeriodType periodType;

    PekReportType(PekPeriodType periodType) {
        this.periodType = periodType;
    }

    public PekPeriodType periodType() {
        return periodType;
    }

    /** Whether this type may be used for a facility under the given monitoring regime. */
    public boolean isAvailableFor(SpecialMonitoringType facilityRegime) {
        if (this != PEM_CASPIAN_ANNUAL) {
            return true;
        }
        return facilityRegime == SpecialMonitoringType.CASPIAN_MARINE;
    }

    /**
     * Classifies a report from its period and the facility it belongs to.
     *
     * <p>An annual period at a Caspian marine facility is the Caspian report; any other annual
     * period is the tables 7/12 submission. A null regime is treated as {@code NONE}: a facility
     * that has not been marked never silently acquires the later Caspian deadline.
     */
    public static PekReportType classify(PekPeriodType periodType, SpecialMonitoringType facilityRegime) {
        if (periodType != PekPeriodType.YEAR) {
            return PEK_QUARTERLY;
        }
        return facilityRegime == SpecialMonitoringType.CASPIAN_MARINE
                ? PEM_CASPIAN_ANNUAL
                : PEK_TABLES_7_12_ANNUAL;
    }
}
