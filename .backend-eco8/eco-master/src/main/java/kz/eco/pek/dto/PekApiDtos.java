package kz.eco.pek.dto;

import java.util.List;

public final class PekApiDtos {

    private PekApiDtos() {
    }

    /** Short, denormalized representations for list/details DTOs - module spec §1: frontend needs
     *  names, not just raw FK ids, and must never re-derive them from a separate lookup call. */
    public record CompanyShortDto(Long id, String name, String bin) {
    }

    public record CompanyObjectShortDto(Long id, String name) {
    }

    public record UserShortDto(Long id, String name, String email, String position) {
    }

    /** One position of control (module spec §6.2). id is null when this row is new; a non-null id
     *  in an edit() request must belong to the program being edited (checked server-side) and is
     *  otherwise updated in place - see PekProgramService#replaceControlItems. */
    public record ControlItemDto(
            Long id,
            String code,
            String name,
            String sectionCode,
            String controlType,
            String environmentComponent,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            Long wasteSourceId,
            Long laboratoryId,
            String frequencyType,
            Integer frequencyValue,
            Integer plannedCount,
            String measurementMethod,
            String samplingMethod,
            String startDate,
            String endDate,
            Long responsibleUserId,
            Boolean mandatory,
            Integer sortOrder,
            Boolean active
    ) {
    }

    /** module spec §6.3 - controlItemId must reference one of the ControlItemDto rows in the same
     *  request (by its index if id is null, or by its id if editing an existing item). */
    public record IndicatorDto(
            Long id,
            Integer controlItemIndex,
            Long controlItemId,
            Long indicatorId,
            String indicatorCode,
            String indicatorName,
            String unit,
            Long normativeId,
            java.math.BigDecimal normativeValue,
            String comparisonType,
            java.math.BigDecimal minValue,
            java.math.BigDecimal maxValue,
            Long methodologyId,
            String measurementDeviceType,
            Boolean mandatory,
            Integer sortOrder
    ) {
    }

    /** module spec §6.4. */
    public record MeasureDto(
            Long id,
            String code,
            String name,
            String description,
            String plannedStartDate,
            String plannedEndDate,
            Long responsibleUserId,
            java.math.BigDecimal plannedBudget,
            String currency,
            String status,
            Integer completionPercent,
            String resultDescription
    ) {
    }

    /** module spec §6.5 - GET-only, upload happens via multipart, never through this DTO. */
    public record ProgramDocumentResponse(
            Long id,
            String documentType,
            String fileName,
            String contentType,
            long size,
            String sha256,
            Long uploadedBy,
            String uploadedAt
    ) {
    }

    public record CreateProgramRequest(
            Long companyId,
            Long objectId,
            String number,
            String name,
            String description,
            String validFrom,
            String validUntil,
            Long responsibleUserId,
            List<ControlItemDto> controlItems,
            List<IndicatorDto> indicators,
            List<MeasureDto> measures
    ) {
    }

    /** PATCH /api/pek/programs/{id} - full aggregate replace, only while the program isEditable()
     *  (DRAFT/RETURNED). Any of controlItems/indicators/measures being null (as opposed to an empty
     *  list) means "leave that collection untouched" - only an explicit empty list clears it. This
     *  is how PATCH /{id}/draft (partial autosave of just the header) reuses this same method
     *  without wiping the positions a user hasn't touched yet in this autosave cycle. */
    public record EditProgramRequest(
            Long version,
            String name,
            String description,
            String validFrom,
            String validUntil,
            Long responsibleUserId,
            List<ControlItemDto> controlItems,
            List<IndicatorDto> indicators,
            List<MeasureDto> measures
    ) {
    }

    public record ReturnProgramRequest(Long version, String reason) {
    }

    public record CloneProgramRequest(String number, String name, String validFrom, String validUntil) {
    }

    public record ProgramHistoryEntry(
            String actionType,
            String actorName,
            String comment,
            String oldValue,
            String newValue,
            String createdAt
    ) {
    }

    public record ProgramResponse(
            Long id,
            Long companyId,
            Long objectId,
            String number,
            String name,
            String description,
            String validFrom,
            String validUntil,
            String status,
            Long responsibleUserId,
            Long reviewerUserId,
            Long approverUserId,
            Integer readinessPercent,
            String submittedAt,
            String approvedAt,
            String activatedAt,
            String archivedAt,
            Long version,
            CompanyShortDto company,
            CompanyObjectShortDto object,
            UserShortDto responsibleUser,
            List<ControlItemDto> controlItems,
            List<IndicatorDto> indicators,
            List<MeasureDto> measures,
            List<ProgramDocumentResponse> documents,
            List<String> availableActions,
            boolean readOnly
    ) {
    }

    public record CreateReportRequest(
            Long companyId,
            Long objectId,
            String periodType,
            Integer year,
            Integer quarter,
            Long programId,
            /** When true, {@link kz.eco.pek.PekReportService#create} runs a real synchronous
             *  collection pass (same as calling POST .../collect right after) before returning -
             *  not a stub, not fire-and-forget. */
            Boolean collectImmediately
    ) {
    }

    /** Result of GET .../creation-context - tells the client whether create() can proceed
     *  unattended (exactly one active program) or needs a human choice/redirect. Field names and
     *  shape match the frontend contract exactly (company/object as short DTOs, "programs" not
     *  "activePrograms", "selectedProgramId" not "autoSelectedProgramId", "duplicateReportId" as
     *  the actual id of the conflicting report rather than a bare boolean) - do not rename these
     *  again without updating the frontend at the same time. */
    public record ReportCreationContext(
            CompanyShortDto company,
            CompanyObjectShortDto object,
            String periodStart,
            String periodEnd,
            List<ProgramResponse> programs,
            Long selectedProgramId,
            Long duplicateReportId,
            List<String> warnings,
            List<String> blockingReasons
    ) {
    }

    public record ReportResponse(
            Long id,
            Long companyId,
            Long objectId,
            Long programId,
            String periodType,
            Integer reportYear,
            Integer reportQuarter,
            String periodStart,
            String periodEnd,
            String status,
            int linkedProtocolCount,
            String lastCollectedAt,
            Long version,
            CompanyShortDto company,
            CompanyObjectShortDto object,
            UserShortDto responsibleUser
    ) {
    }

    public record CollectionResult(
            ReportResponse report,
            int linkedProtocolCount,
            List<String> linkedProtocolNumbers
    ) {
    }

    /**
     * GET /api/pek/dashboard. Every field is computed from real rows in pek_programs/pek_reports -
     * none are fabricated. criticalIssueCount/openExceedanceCount/overdueActionCount/
     * missingProtocolCount are honestly 0 today: this module has no Issue/Exceedance/Action/
     * ControlItem entities yet (only PekProgram/PekReport/PekReportProtocolSource exist), so there
     * is nothing yet to count for them - see PekDashboardService's javadoc for exactly which
     * fields are "real metric" vs "real zero, feature not built yet".
     */
    public record DashboardResponse(
            long totalReportCount,
            int readinessPercent,
            long criticalIssueCount,
            long overdueRiskCount,
            int programExecutionPercent,
            long openExceedanceCount,
            long overdueActionCount,
            long missingProtocolCount,
            List<DashboardDeadline> deadlines,
            List<ReportResponse> reports
    ) {
    }

    /** A real upcoming deadline derived from actual data - today, that's only an ACTIVE program's
     *  validUntil falling inside the lookahead window (report-level dueDate tracking doesn't exist
     *  as a modeled field yet, so it isn't a source of deadlines here). */
    public record DashboardDeadline(
            Long id,
            String type,
            String date,
            String description
    ) {
    }

    /** GET /api/pek/lookups/assignees. "role" echoes back which of the requested lookup role
     *  tokens (e.g. PEK_RESPONSIBLE, PEK_REVIEWER) this user was matched under. */
    public record AssigneeResponse(
            Long id,
            String name,
            String description,
            String status,
            String role
    ) {
    }

    /** GET /api/pek/lookups/objects/{objectId}/permits. No permit entity exists anywhere in this
     *  codebase yet (confirmed - there is nothing to look up) - this shape is defined so the
     *  endpoint has a real, stable (currently always-empty) contract instead of a 404, rather than
     *  fabricating placeholder permits. */
    public record PermitResponse(
            Long id,
            String number,
            String name,
            String validUntil
    ) {
    }
}
