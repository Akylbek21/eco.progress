package kz.eco.pek.docgen;

import java.util.List;

/**
 * Snapshot of a full PEK program, for rendering the program document itself.
 *
 * <p>There was no such snapshot before. The program DOCX in the report package was assembled inline
 * from four lines (title, number, period, and one line per monitoring direction) and the PDF from
 * three, so neither contained the programme: no control items, no controlled indicators, no
 * sampling points, no internal inspections, no measurement QA, no emergency procedures, no
 * responsibility structure. None of that was a rendering bug - the document simply never carried
 * the data.
 *
 * <p>Like the report snapshots, this is flat and serialization-friendly so a generated program
 * document stays reproducible from what it was generated with.
 */
public record PekProgramDocValues(
        String number,
        String name,
        String status,
        String regulationCode,
        String regulationVersion,
        String templateVersion,
        String validFrom,
        String validUntil,
        String generatedAtLabel,
        long contentRevision,
        OfficialPekReportDocValues.GeneralInfo generalInfo,
        String description,
        String monitoringScope,
        List<PekReportDocValues.PermitRow> permits,
        List<OfficialPekReportDocValues.MonitoringRow> monitoring,
        List<ControlItemRow> controlItems,
        List<IndicatorRow> indicators,
        boolean applicableAir,
        List<OfficialPekReportDocValues.EmissionSourceRow> emissionSources,
        boolean applicableWater,
        List<OfficialPekReportDocValues.DischargeSourceRow> dischargeSources,
        boolean applicableWaste,
        List<WasteCatalogueRow> wasteItems,
        List<InspectionRow> internalInspections,
        List<MeasurementQaRow> measurementQa,
        List<EmergencyRow> emergencyProcedures,
        List<ResponsibilityRow> responsibilities,
        String responsibleUserName,
        String headOfOrganizationName
) {

    public record ControlItemRow(String code, String name, String controlType, String environmentComponent,
                                  String frequency, String plannedCount, String measurementMethod,
                                  String samplingMethod, String period) {
    }

    /** A controlled indicator with the norm it is compared against and the method used. */
    public record IndicatorRow(String controlItemName, String code, String name, String unit,
                                String normativeValue, String comparison, String range,
                                String measurementDeviceType, boolean mandatory) {
    }

    /** The waste catalogue as the PROGRAM declares it - accumulation terms only, no period figures:
     *  those belong to a report, not to the program. */
    public record WasteCatalogueRow(String name, String code, String hazardClass, String accumulationLimit,
                                     String limitUnit, String accumulationPeriodDays, String storageSiteName,
                                     String coordinates) {
    }

    public record InspectionRow(String plannedDate, String inspectionType, String status, String responsible) {
    }

    public record MeasurementQaRow(String parameter, String qaProcedure, String frequency,
                                    String lastCheckDate, String nextCheckDate) {
    }

    public record EmergencyRow(String scenario, String actions, String contactPhone) {
    }

    public record ResponsibilityRow(String roleLabel, String userName, String duties) {
    }
}
