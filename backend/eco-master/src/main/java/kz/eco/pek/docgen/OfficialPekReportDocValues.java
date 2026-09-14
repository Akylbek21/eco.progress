package kz.eco.pek.docgen;

import java.util.List;

/**
 * Snapshot for the official (state-facing) PEK report.
 *
 * <p>Previously this record carried the same four lists as the internal analytical report -
 * permits, plan/fact, exceedances, protocols - which is why the "official" document was, in
 * substance, the internal one under a different name. The official report is organised around
 * administrative data and per-component environmental tables, so those are what it now carries:
 * general facility information, permits, the monitoring programme actually carried out, and the
 * air / water / waste tables.
 *
 * <p>{@code applicable*} flags come from the program's declared monitoring directions, the same
 * applicability rule readiness uses. A component the program does not declare is not rendered as an
 * empty table - it is not part of this facility's report at all.
 *
 * <p>Persisted verbatim as JSON into {@code PekReportDocumentVersion.snapshotJson}, so a signed
 * document stays reproducible from its own snapshot.
 */
public record OfficialPekReportDocValues(
        String reportNumber,
        int version,
        String regulationCode,
        String regulationVersion,
        String templateVersion,
        String reportType,
        String periodLabel,
        String periodStart,
        String periodEnd,
        String submissionDueDate,
        String generatedAtLabel,
        GeneralInfo generalInfo,
        List<PekReportDocValues.PermitRow> permits,
        List<MonitoringRow> monitoring,
        boolean applicableAir,
        List<EmissionSourceRow> emissionSources,
        boolean applicableWater,
        List<DischargeSourceRow> dischargeSources,
        boolean applicableWaste,
        List<WasteRow> waste,
        List<PekReportDocValues.PlanFactRow> planFactRows,
        List<PekReportDocValues.ExceedanceRow> exceedances,
        List<PekReportDocValues.ProtocolRow> protocols,
        String responsibleUserName,
        String headOfOrganizationName
) {

    /**
     * The administrative-data block: КАТО, БИН, ОКЭД, категория, координаты, характеристика
     * производства, проектная и фактическая мощность, реквизиты.
     *
     * <p>Read from the program's facility snapshot rather than from the live company/object rows,
     * so a report keeps reporting the facility as it stood when the program was drawn up.
     */
    public record GeneralInfo(
            String companyName,
            String companyBin,
            String legalAddress,
            String actualAddress,
            String phone,
            String objectName,
            String objectAddress,
            String kato,
            String oked,
            String environmentalCategory,
            String coordinates,
            String productionCharacteristics,
            String designCapacity,
            String actualCapacity,
            String programNumber,
            String programName,
            String programValidFrom,
            String programValidUntil
    ) {
    }

    /** One declared monitoring direction and what was planned/carried out for it. */
    public record MonitoringRow(String monitoringType, String name, String methodology, String frequency,
                                 int pointCount, String pointNames) {
    }

    public record EmissionSourceRow(String code, String name, String sourceType, String workshopName,
                                     String heightM, String diameterM, String coordinates,
                                     String gasCleaningEquipment, String cleaningEfficiencyPercent,
                                     String operatingHoursPerYear) {
    }

    public record DischargeSourceRow(String code, String name, String receivingWaterBody, String dischargeType,
                                      String coordinates, String permittedVolume, String volumeUnit,
                                      String treatmentFacilities) {
    }

    /** Waste accumulation and movement: the catalogue terms and the period's figures in one row,
     *  which is how the table is read even though they are stored separately. */
    public record WasteRow(String name, String code, String hazardClass, String accumulationLimit,
                            String limitUnit, String accumulationPeriodDays, String storageSiteName,
                            String coordinates, String openingBalance, String generated, String transferred,
                            String disposed, String closingBalance, String receiverName, String receiverBin,
                            boolean reconciles) {
    }
}
