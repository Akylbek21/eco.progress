package kz.eco.pek.docgen;

import java.util.List;

/**
 * Snapshot for the internal CRM analytical PEK report. Layout is driven by operational management
 * needs (plan/fact deltas, exceedance analytics, completeness percentage) rather than the normative
 * template shape. Not subject to the Правила №250 template constraint, though regulationVersion is
 * still stamped for traceability.
 */
public record InternalPekAnalyticalDocValues(
        String reportNumber,
        int version,
        String regulationVersion,
        String companyName,
        String companyBin,
        String objectName,
        String programName,
        String periodLabel,
        String periodStart,
        String periodEnd,
        String responsibleUserName,
        String generatedAtLabel,
        int totalControlItems,
        int completedControlItems,
        int overallCompletionPercent,
        int totalExceedances,
        List<PekReportDocValues.PlanFactRow> planFactRows,
        List<PekReportDocValues.ExceedanceRow> exceedances,
        List<PekReportDocValues.ProtocolRow> protocols
) {
}
