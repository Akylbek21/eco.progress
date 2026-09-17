package kz.eco.pek.docgen;

import java.util.List;

/**
 * Snapshot the explanatory note is rendered from - both the DOCX and the PDF made from it, and the
 * JSON stored on the document version. Every narrative field is copied as entered; a missing one
 * is reported by {@link PekExplanatoryNoteGenerationService#issues} and generation is refused, so
 * the renderer never has to invent a paragraph for it.
 */
public record PekExplanatoryNoteDocValues(
        String reportNumber,
        int version,
        String periodLabel,
        String periodStart,
        String periodEnd,
        String generatedAtLabel,

        // 1. Сведения о предприятии и объекте
        String companyName,
        String companyBin,
        String legalAddress,
        String objectName,
        String objectAddress,
        String kato,
        String oked,
        String environmentalCategory,
        String programNumber,
        String programName,

        // 2. Характеристика производства
        String facilityInformation,
        String productionCharacteristics,
        String technologicalProcess,
        String designCapacity,
        String actualCapacity,

        // 3. Источники воздействия
        String mainImpactSources,
        int emissionSourceCount,
        int dischargeSourceCount,
        int wasteItemCount,

        // 4. Выполненные исследования
        String performedStudies,
        List<MonitoringRow> monitoring,
        List<ProtocolRow> protocols,

        // 5. Результаты мониторинга
        String monitoringResultsSummary,
        int plannedMeasurements,
        int completedMeasurements,

        // 6. Превышения и принятые меры
        List<ExceedanceRow> exceedances,
        String exceedancesSummary,
        String measuresTaken,

        // 7. Вывод
        String conclusion,

        String responsibleName,
        String directorName
) {

    public record MonitoringRow(String component, String name, String methodology, String points) {}

    public record ProtocolRow(String number, String date, String laboratory) {}

    public record ExceedanceRow(String indicator, String actual, String normative, String ratio,
                                String status, String correctiveAction) {}
}
