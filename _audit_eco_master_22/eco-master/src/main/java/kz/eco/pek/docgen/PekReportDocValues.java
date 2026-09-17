package kz.eco.pek.docgen;

import java.util.List;

/**
 * Flat, serialization-friendly snapshot of everything needed to render a PEK final report -
 * assembled by PekReportDocumentGenerationService, rendered by PekReportDocxRenderer, and also
 * persisted verbatim (as JSON, via the project's tools.jackson ObjectMapper) into
 * PekReportDocumentVersion.snapshotJson for audit/reproducibility. Mirrors the role
 * kz.eco.protocol.docgen.ProtocolDocValues plays for protocol documents.
 */
public record PekReportDocValues(
        String reportNumber,
        int version,
        String companyName,
        String companyBin,
        String objectName,
        String programName,
        String periodLabel,
        String periodStart,
        String periodEnd,
        String responsibleUserName,
        String generatedAtLabel,
        List<PermitRow> permits,
        List<PlanFactRow> planFactRows,
        List<ExceedanceRow> exceedances,
        List<ProtocolRow> protocols
) {
    public record PermitRow(String type, String number, String validUntil, String status) {
    }

    public record PlanFactRow(String controlItemName, int planned, int actual, String completionPercent,
                               int exceedanceCount) {
    }

    public record ExceedanceRow(String indicatorName, String actualValue, String normativeValue, String ratio,
                                 String status, String correctiveAction) {
    }

    public record ProtocolRow(String number, String date, String laboratory) {
    }
}
