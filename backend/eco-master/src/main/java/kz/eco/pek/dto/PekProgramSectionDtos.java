package kz.eco.pek.dto;

/** DTOs for the five Правила №250 program sections added in module fix item 4: monitoring points,
 *  internal inspections, measurement QA, emergency procedures, responsibility structure. */
public final class PekProgramSectionDtos {

    private PekProgramSectionDtos() {
    }

    public record MonitoringPointDto(Long id, Long monitoringId, Long programId, String name,
                                      String coordinates, String description, Long version) {
    }

    public record MonitoringPointRequest(String name, String coordinates, String description) {
    }

    public record InternalInspectionDto(Long id, Long programId, String plannedDate, String actualDate,
                                         String inspectionType, String findings, boolean correctiveActionRequired,
                                         Long responsibleUserId, String status, Long version) {
    }

    public record InternalInspectionRequest(String plannedDate, String actualDate, String inspectionType,
                                             String findings, Boolean correctiveActionRequired,
                                             Long responsibleUserId, String status) {
    }

    public record MeasurementQaDto(Long id, Long programId, String parameter, String qaProcedure,
                                    String frequency, Long responsibleUserId, String lastCheckDate,
                                    String nextCheckDate, Long version) {
    }

    public record MeasurementQaRequest(String parameter, String qaProcedure, String frequency,
                                        Long responsibleUserId, String lastCheckDate, String nextCheckDate) {
    }

    public record EmergencyProcedureDto(Long id, Long programId, String scenario, String actions,
                                         Long responsibleUserId, String contactPhone, Long version) {
    }

    public record EmergencyProcedureRequest(String scenario, String actions, Long responsibleUserId, String contactPhone) {
    }

    public record ResponsibilityDto(Long id, Long programId, String roleLabel, Long userId, String duties, Long version) {
    }

    public record ResponsibilityRequest(String roleLabel, Long userId, String duties) {
    }

    // ---- subject-domain inventories -------------------------------------------------------------
    // Numeric fields travel as String, matching how every other decimal in this module's DTOs is
    // carried, so a value is never silently reshaped by JSON float parsing on its way in or out.

    public record EmissionSourceDto(Long id, Long programId, String code, String name, String sourceType,
                                     String workshopName, String heightM, String diameterM, String coordinates,
                                     String gasCleaningEquipment, String cleaningEfficiencyPercent,
                                     Integer operatingHoursPerYear, String description, int sortOrder,
                                     Long version) {
    }

    public record EmissionSourceRequest(String code, String name, String sourceType, String workshopName,
                                         String heightM, String diameterM, String coordinates,
                                         String gasCleaningEquipment, String cleaningEfficiencyPercent,
                                         Integer operatingHoursPerYear, String description, Integer sortOrder) {
    }

    public record DischargeSourceDto(Long id, Long programId, String code, String name, String receivingWaterBody,
                                      String dischargeType, String coordinates, String permittedVolume,
                                      String volumeUnit, String treatmentFacilities, String description,
                                      int sortOrder, Long version) {
    }

    public record DischargeSourceRequest(String code, String name, String receivingWaterBody, String dischargeType,
                                          String coordinates, String permittedVolume, String volumeUnit,
                                          String treatmentFacilities, String description, Integer sortOrder) {
    }

    public record WasteItemDto(Long id, Long programId, String name, String code, String hazardClass,
                                String accumulationLimit, String limitUnit, Integer accumulationPeriodDays,
                                String storageSiteName, String coordinates, String description,
                                int sortOrder, Long version) {
    }

    public record WasteItemRequest(String name, String code, String hazardClass, String accumulationLimit,
                                    String limitUnit, Integer accumulationPeriodDays, String storageSiteName,
                                    String coordinates, String description, Integer sortOrder) {
    }

    /** @param reconciles false when the stated closingBalance does not equal
     *                    opening + generated - transferred - disposed. Surfaced rather than
     *                    auto-corrected: the entered figure is what gets reported. */
    public record WasteMovementDto(Long id, Long reportId, Long wasteItemId, String wasteItemName,
                                    String wasteItemCode, String hazardClass, String unit,
                                    String openingBalance, String generated, String transferred, String disposed,
                                    String closingBalance, String impliedClosingBalance, boolean reconciles,
                                    String receiverName, String receiverBin, String note, Long version) {
    }

    public record WasteMovementRequest(Long wasteItemId, String openingBalance, String generated,
                                        String transferred, String disposed, String closingBalance,
                                        String receiverName, String receiverBin, String note) {
    }
}
