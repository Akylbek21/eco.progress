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

    public record ScopeCompanyResponse(Long id, String name, String bin) {
    }

    public record ScopeCompanyObjectResponse(Long id, Long companyId, String name, String address,
                                             String status) {
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
            /** true - позиция выполняется по всем точкам мониторинга направления; при этом
             *  monitoringPointId должен быть пустым. Если не задано ни то, ни другое, позиция
             *  считается ненастроенной: требование по ней отдаётся со статусом
             *  CONFIGURATION_REQUIRED и по точкам не размножается. */
            Boolean appliesToAllPoints,
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

    /** Returned by the evidence-file upload endpoint - the resulting fileId is only ever valid to
     *  attach to THIS exceedance (see PekExceedanceService#attachEvidence's ownership check).
     *  version is the exceedance's current optimistic-lock version after the upload - the caller
     *  must pass it back as If-Match on the follow-up POST .../evidence attach call. */
    public record EvidenceFileUploadResponse(String fileId, String fileName, String contentType, long size, Long version) {
    }

    /** Snapshot fields that record facility state at the time the program is authored (item 1).
     *  Program-level actualCapacity was removed (module fix): actual, as-operated capacity relates
     *  to one reporting PERIOD, not the multi-year program - see {@code PekReport.actualCapacity}
     *  and {@code PATCH /api/pek/reports/{id}/general}. A client that still sends actualCapacity
     *  here gets a 200 with the value silently ignored and logged (see PekUnknownFieldReporter),
     *  never a 400 - removing a field must not become a breaking change for an old client. */
    public record FacilitySnapshotDto(
            String facilityInformation,
            String kato,
            String binSnapshot,
            String oked,
            String environmentalCategory,
            String designCapacity,
            String productionCharacteristics,
            String monitoringScope,
            String readinessNotes,
            /** Unit for designCapacity (e.g. "т/год"). Appended at the end so existing positional
             *  construction keeps compiling. */
            String designCapacityUnit
    ) {}

    public record PermitShortDto(Long id, String type, String number, String authority,
                                 String validFrom, String validTo, String status) {}

    public record CreateProgramRequest(
            Long companyId,
            Long objectId,
            String number,
            String name,
            String description,
            String validFrom,
            String validUntil,
            Long responsibleUserId,
            /** Snapshot of facility data at creation time (item 1 / V109). */
            FacilitySnapshotDto facilitySnapshot,
            /** IDs of existing environmental permits to associate with this program (item 10). */
            List<Long> permitIds,
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
            String name,
            String description,
            String validFrom,
            String validUntil,
            Long responsibleUserId,
            /** Null = leave facility snapshot unchanged; non-null replaces all snapshot fields. */
            FacilitySnapshotDto facilitySnapshot,
            /** Null = leave permit associations unchanged; non-null list replaces current associations. */
            List<Long> permitIds,
            List<ControlItemDto> controlItems,
            List<IndicatorDto> indicators,
            List<MeasureDto> measures
    ) {
    }

    public record ReturnProgramRequest(String reason) {
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
            java.util.Map<String, Boolean> availableActions,
            boolean readOnly,
            /** Module fix item 4: which regulation/template edition this program's content
             *  follows, and a business-visible "how many times has the content changed" counter -
             *  see kz.eco.pek.PekProgramContentRevisionService. */
            String regulationVersion,
            /** Code of the reference-book entry the free-text regulationVersion above renders.
             *  This is what deadline rules and templates are keyed on. */
            String regulationCode,
            String templateVersion,
            long contentRevision,
            /** Facility snapshot fields (item 1 / V109). */
            FacilitySnapshotDto facilitySnapshot,
            /** Permits linked to this program (item 10). */
            List<PermitShortDto> permits,
            /** Only populated by monitoring create/update/delete responses (so the frontend gets
             *  the up-to-date monitoring list without a second round-trip) - null elsewhere. */
            PekMonitoringDtos.ListResponse monitoring,
            /* Module fix: readiness is the ONLY source of "is this program ready" - the frontend
               must never recompute a percentage or a ready/not-ready verdict itself. readinessPercent
               above already carries the progress number; ready/blockingReasons/warnings are the
               rest of the same PekProgramReadinessService#evaluate call, appended at the end so
               existing positional construction keeps compiling. */
            boolean ready,
            List<String> blockingReasons,
            List<String> warnings
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
            /** ISO date, computed by PekSubmissionDeadlineService from (report type, regulation
             *  code of the selected program, periodEnd) - exactly what create() will stamp. Null
             *  when no single covering ACTIVE program is selected (see blockingReasons). */
            String submissionDueDate,
            /** Regulation reference-book CODE of the selected ACTIVE program (e.g.
             *  PEK_RULES_250_2026_59) - null without a selected program, never guessed. */
            String regulationVersion,
            /** Form template version of the selected ACTIVE program (e.g. v2-2026) - null without
             *  a selected program. */
            String templateVersion,
            List<ProgramResponse> programs,
            Long selectedProgramId,
            Long duplicateReportId,
            List<String> warnings,
            List<String> blockingReasons,
            /** Canonical report type this creation-context would produce, classified backend-side
             *  by PekReportType.classify(periodType, object.specialMonitoringType) - the exact same
             *  rule create() uses to stamp PekReport.reportType. Null when it cannot yet be
             *  determined (no object or no valid periodType) - see blockingReasons in that case,
             *  never guessed on the frontend. */
            String reportType,
            /** DRAFT/RETURNED programs on this object that are no longer on the current regulation/
             *  template edition (item 2) - distinct from "programs" above, which only ever lists
             *  ACTIVE programs eligible to back a new report. Lets the frontend surface "this
             *  program needs actualization" without conflating it with report-creation eligibility. */
            List<ProgramRequiringUpdate> programsRequiringUpdate
    ) {
    }

    /** One DRAFT/RETURNED program that is behind the current regulation/template edition. Backend-
     *  computed reason and availableActions only - RETEMPLATE must never be offered by the frontend
     *  on its own judgement (item 2/6 of the contract gap list). */
    public record ProgramRequiringUpdate(
            Long id,
            String number,
            String name,
            String status,
            String regulationVersion,
            String regulationCode,
            String templateVersion,
            String reason,
            java.util.Map<String, Boolean> availableActions
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
            UserShortDto responsibleUser,
            java.util.Map<String, Boolean> availableActions,
            ReturnInfo returnInfo,
            /* Submission lifecycle, appended at the end so existing positional construction stays
               backward compatible. ISO-8601 strings (submissionDueDate is a date, the rest are
               local date-times); null until the corresponding transition has happened. */
            String submissionDueDate,
            String submittedAt,
            String acceptedAt,
            String rejectedAt,
            String rejectionReason,
            /** Official filing details (module spec P1, item 26): returned whenever the report is
             *  reopened, null until a submission has been recorded. */
            SubmissionRecord submission,
            /* Module fix (official report structure): normative basis/content-change bookkeeping,
               plus everything a client previously had to compute itself. Appended so positional
               construction stays backward compatible; never computed on the frontend. */
            long contentRevision,
            String regulationVersion,
            String regulationCode,
            String templateVersion,
            String reportType,
            /** Distinct finalized-protocol numbers linked by the last collect() run. */
            List<String> linkedProtocolNumbers,
            String actualCapacity,
            String actualCapacityUnit,
            /** Null until collect() has resolved a laboratory behind this report's matched
             *  protocols and frozen it - see {@link PekReport#hasLaboratorySnapshot()}. */
            LaboratorySnapshotDto laboratorySnapshot,
            /** Coarse status of the official-data build (see {@code GET .../official-data}), so a
             *  list view can show "not yet collected" vs "has gaps" vs "complete" without a second
             *  round-trip. */
            String officialDataStatus,
            /** Non-blocking readiness warnings, mirrored here for convenience (module spec:
             *  creation-context already does the same for program selection). */
            List<String> warnings,
            /** Blocking readiness issues' messages, same source as GET .../readiness. */
            List<String> blockingReasons
    ) {
    }

    /** PATCH /api/pek/reports/{id}/general - the handful of report-level fields that relate to
     *  THIS reporting period rather than the program (module fix: actual capacity moved off
     *  PekProgram - see {@link PekReport#getActualCapacity()}). Both null means "leave unchanged". */
    public record UpdateReportGeneralRequest(String actualCapacity, String actualCapacityUnit) {
    }

    /** Frozen once per report - see {@link PekReport#hasLaboratorySnapshot()}. */
    public record LaboratorySnapshotDto(
            Long laboratoryId,
            String laboratoryName,
            String laboratoryBin,
            String accreditationNumber,
            String accreditationValidFrom,
            String accreditationValidUntil,
            String accreditationScope
    ) {
    }

    public record ReturnInfo(String reason, String returnedAt, UserShortDto returnedBy) {}
    public record ReportHistoryEntry(String action, String fromStatus, String toStatus, String comment,
                                     UserShortDto performedBy, String performedAt, Long version) {}

    /**
     * Result of POST .../collect - a real reconciliation summary (module spec: PekReportCollectionService
     * rewrite), not just a linked-count. New fields are appended at the end so existing positional
     * construction stays backward compatible: protocolResultCount/matchedCount/unmatchedCount/
     * ambiguousCount describe the report's CURRENT full state after this collect() (including rows
     * untouched by this run), removedStaleSourceCount/updatedSourceCount describe what THIS run
     * changed, and warnings surfaces manual links that fell out of the actual finalized-protocol set
     * without being auto-deleted.
     */
    public record CollectionResult(
            ReportResponse report,
            int linkedProtocolCount,
            List<String> linkedProtocolNumbers,
            int protocolResultCount,
            int matchedCount,
            int unmatchedCount,
            int ambiguousCount,
            int removedStaleSourceCount,
            int updatedSourceCount,
            List<String> warnings
    ) {
    }

    /** GET /api/pek/reports/{id}/plan-fact - real per-indicator counts computed by
     *  PekPlanFactService from matched protocol results, not fabricated. */
    public record PlanFactResponse(
            PlanFactSummary summary,
            List<PlanFactItem> items
    ) {
    }

    public record PlanFactSummary(
            int planned,
            int completed,
            int missing,
            java.math.BigDecimal completionPercent,
            int exceedances
    ) {
    }

    public record PlanFactItem(
            Long planFactRowId,
            Long controlItemId,
            String controlItemName,
            Long indicatorId,
            String indicatorName,
            String unit,
            int plannedCount,
            int actualCount,
            int missingCount,
            java.math.BigDecimal completionPercent,
            java.math.BigDecimal normativeValue,
            String comparisonType,
            java.math.BigDecimal bestValue,
            java.math.BigDecimal worstValue,
            java.math.BigDecimal averageValue,
            boolean hasExceedance,
            int exceedanceCount,
            String status
    ) {
    }

    /** GET /api/pek/reports/{id}/sources - one row per {@code PekReportProtocolSource}, the real
     *  reconciliation detail behind the summary counts in {@link CollectionResult}/plan-fact. Lets a
     *  reviewer see exactly which protocol/result matched which indicator, which are UNMATCHED/
     *  AMBIGUOUS and need a manual decision, and which manual links exist. */
    public record ReportSourceItem(
            Long id,
            Long protocolId,
            String protocolNumber,
            Long protocolResultId,
            String indicatorName,
            String unit,
            Long controlItemId,
            Long programIndicatorId,
            String matchStatus,
            String matchType,
            boolean manual,
            boolean excluded,
            String exclusionReason,
            Long sourceVersion,
            Long version,
            String matchReason,
            String matchedAt,
            String updatedAt,
            String protocolDate,
            String protocolStatus,
            String indicatorCode,
            java.math.BigDecimal value,
            String valueText,
            java.math.BigDecimal normativeValue,
            String comparisonType,
            Boolean isExceedance,
            String samplingPlace,
            String measurementDate,
            String methodology,
            String laboratoryName,
            String controlItemName,
            String programIndicatorName,
            String createdAt
    ) {
        public ReportSourceItem(Long id, Long protocolId, String protocolNumber, Long protocolResultId,
                String indicatorName, String unit, Long controlItemId, Long programIndicatorId,
                String matchStatus, String matchType, boolean manual, boolean excluded,
                String exclusionReason, Long sourceVersion, Long version, String matchReason,
                String matchedAt, String updatedAt) {
            this(id, protocolId, protocolNumber, protocolResultId, indicatorName, unit, controlItemId,
                    programIndicatorId, matchStatus, matchType, manual, excluded, exclusionReason,
                    sourceVersion, version, matchReason, matchedAt, updatedAt, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    public record MatchSourceRequest(Long indicatorId) {}
    public record SourceMutationRequest(String reason) {}
    public record ReturnReportRequest(String reason) {}

    public record SourceSummary(long linkedProtocolCount, long linkedResultCount,
                                long unmatchedResultCount, long ambiguousResultCount,
                                long staleResultCount, long excludedResultCount) {}

    /** Item 3 of the contract gap list: nullable location fields so the frontend can jump straight
     *  to the offending table/row instead of only showing a message string. Not all fields apply to
     *  every issue - e.g. a program-level check like NO_CONTROL_ITEMS sets none of them, while an
     *  official-data row issue like MISSING_NORMATIVE sets tableType/protocolResultId/controlItemId.
     *  The 5-arg constructor is kept for the many existing call sites that don't have this context. */
    public record ReadinessIssue(String code, String section, String severity, String message, boolean blocking,
                                 String tableType, String entityType, Long entityId, Long protocolId,
                                 Long protocolResultId, Long controlItemId, Long monitoringPointId, String field) {
        public ReadinessIssue(String code, String section, String severity, String message, boolean blocking) {
            this(code, section, severity, message, blocking, null, null, null, null, null, null, null, null);
        }
    }
    public record ReadinessSummary(int planned, int completed, int missing, long unmatched,
                                   long ambiguous, long stale, long openExceedances,
                                   long overdueActions) {}
    /** Structured readiness result (Iteration 2 of the PEK module overhaul): {@code issues} keeps
     *  the original flat list for backward compatibility with existing callers/tests, while
     *  {@code blockingIssues}/{@code warnings} split it by {@link ReadinessIssue#blocking()} - the
     *  shape the spec asks for (boolean ready, blockingIssues, warnings) without breaking every
     *  existing caller of {@code issues()}/{@code summary()}. */
    public record ReadinessResponse(boolean ready, int progressPercent,
                                    ReadinessSummary summary, List<ReadinessIssue> issues,
                                    List<ReadinessIssue> blockingIssues, List<ReadinessIssue> warnings) {
        public ReadinessResponse(boolean ready, int progressPercent, ReadinessSummary summary, List<ReadinessIssue> issues) {
            this(ready, progressPercent, summary, issues,
                    issues.stream().filter(ReadinessIssue::blocking).toList(),
                    issues.stream().filter(i -> !i.blocking()).toList());
        }
    }

    // --- Exceedance / corrective-action workflow (Iteration 2) -----------------------------

    public record ExceedanceResponse(
            Long id,
            Long reportId,
            Long planFactRowId,
            Long protocolId,
            Long protocolResultId,
            Long programIndicatorId,
            java.math.BigDecimal actualValue,
            java.math.BigDecimal normativeValue,
            String comparisonType,
            java.math.BigDecimal exceedanceRatio,
            String severity,
            String status,
            String comment,
            Long responsibleUserId,
            UserShortDto responsibleUser,
            String correctiveAction,
            String dueDate,
            String completedAt,
            Long completedBy,
            String resolutionComment,
            List<String> evidenceFileIds,
            String resolvedAt,
            Long resolvedBy,
            String resolution,
            String createdAt,
            String updatedAt,
            Long version,
            java.util.Map<String, Boolean> availableActions
    ) {
    }

    public record AssignExceedanceResponsibleRequest(Long responsibleUserId, String dueDate,
                                                       String correctiveAction) {
    }

    public record TransitionExceedanceRequest(String status, String comment,
                                                String resolutionComment) {
    }

    public record AttachExceedanceEvidenceRequest(String fileId) {
    }

    public record CorrectiveActionResponse(
            Long id, Long exceedanceId, String description, Long responsibleUserId,
            UserShortDto responsible, String dueDate, String status, String comment,
            String completedAt, Long completedBy, String createdAt, String updatedAt,
            Long version, java.util.Map<String, Boolean> availableActions
    ) {
    }

    public record CorrectiveActionRequest(
            String description, Long responsibleUserId, String dueDate
    ) {
    }

    public record CorrectiveActionTransitionRequest(String status, String comment) {
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
            long returnedReportCount,
            long unmatchedSourceCount,
            long ambiguousSourceCount,
            long staleSourceCount,
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

    /** GET /api/pek/lookups/objects/{objectId}/permits and the full permit CRUD surface
     *  (Iteration 2 of the PEK module overhaul) - now backed by the real
     *  {@link kz.eco.pek.PekEnvironmentalPermit} entity instead of an always-empty stub. */
    public record PermitResponse(
            Long id,
            Long companyId,
            Long objectId,
            String type,
            String number,
            String issuedAt,
            String validFrom,
            String validTo,
            String authority,
            String status,
            boolean effectivelyActive,
            String fileId,
            String note,
            Long pekProgramId,
            Long version,
            java.util.Map<String, Boolean> availableActions
    ) {
    }

    public record CreatePermitRequest(
            Long companyId,
            Long objectId,
            String type,
            String number,
            String issuedAt,
            String validFrom,
            String validTo,
            String authority,
            String fileId,
            String note,
            Long pekProgramId
    ) {
    }

    public record UpdatePermitRequest(
            String type,
            String number,
            String issuedAt,
            String validFrom,
            String validTo,
            String authority,
            String fileId,
            String note,
            Long pekProgramId
    ) {
    }

    public record ChangePermitStatusRequest(String status, String comment) {
    }

    /** POST /api/pek/permits/files - the returned fileId is then passed as CreatePermitRequest/
     *  UpdatePermitRequest.fileId, same "upload first, reference the id afterward" flow as PEK
     *  program documents. */
    public record PermitFileUploadResponse(String fileId, String fileName, String contentType, long size) {
    }

    // --- Official submission record (module spec P1, items 22-26) -----------------------------

    /** Manual attestation that a signed report was filed with the regulator. Kept separate from
     *  the internal submitReview/approve cycle - see PekReportSubmissionService. */
    /** Body of POST /api/pek/reports/{id}/submit - the official submission record.
     *  submittedAt: ISO-8601 date-time, with or without offset (required, not in the future, not
     *  before signing). submissionMethod: ECO_PORTAL | EGOV_PORTAL | EMAIL | PAPER | COURIER | OTHER
     *  (required; unknown values -> 400). registrationNumber: required for ECO_PORTAL/EGOV_PORTAL.
     *  confirmationFileId: optional, id returned by POST .../submission/file for THIS report
     *  (number or string). comment: optional, required for OTHER. */
    public record SubmitReportRequest(
            String submittedAt,
            String registrationNumber,
            String submissionMethod,
            String confirmationFileId,
            String comment
    ) {
    }

    public record RecordSubmissionRequest(
            /** EGOV_PORTAL | EMAIL | PAPER | COURIER | OTHER - see PekSubmissionMethod. */
            String submissionMethod,
            String registrationNumber,
            String submissionComment,
            /** Stored-file id returned by POST /api/pek/reports/{id}/submission/file. */
            String confirmationFileId,
            /** ISO-8601 local date-time. Defaults to now when omitted; may not be in the future. */
            String submittedAt
    ) {
    }

    public record SubmissionRecord(
            String submissionMethod,
            String registrationNumber,
            String submissionComment,
            String confirmationFileId,
            String submittedAt,
            UserShortDto submittedBy,
            String createdAt,
            String updatedAt
    ) {
    }

    public record PermitHistoryEntry(String fromStatus, String toStatus, String comment,
                                      UserShortDto performedBy, String performedAt) {
    }

    // --- Official report structure (module fix: normative + actual-result tables) ----------

    /** GET /api/pek/reports/{id}/official-data - everything the official DOCX renders, assembled
     *  from persisted {@code PekReportResultRow}s, never recomputed differently by two callers.
     *  {@code tables} carries only the datasets applicable to this program/object (module spec:
     *  "неприменимая таблица не должна блокировать readiness" - it also must not even appear
     *  here, an empty list for an inapplicable table would be indistinguishable from "applicable
     *  but genuinely empty"). */
    public record OfficialReportData(
            OfficialGeneralInfo general,
            LaboratorySnapshotDto laboratory,
            /** Which of the 9 official tables apply to this program/object, and why not for the
             *  rest - lets a client explain an absent table instead of guessing. */
            List<TableApplicability> applicability,
            OfficialTables tables,
            boolean ready,
            int progressPercent
    ) {
    }

    public record OfficialGeneralInfo(
            String companyName,
            String companyBin,
            String objectName,
            String kato,
            String oked,
            String environmentalCategory,
            String coordinates,
            String designCapacity,
            String actualCapacity,
            String actualCapacityUnit,
            String programNumber,
            String programName,
            String regulationVersion,
            String regulationCode,
            String templateVersion,
            String periodStart,
            String periodEnd,
            String submissionDueDate
    ) {
    }

    public record TableApplicability(String tableType, boolean applicable, String reason) {
    }

    public record OfficialTables(
            List<EmissionResultRow> emissions,
            List<ResultRow> instrumentalMeasurements,
            List<CalculatedEmissionResultRow> calculatedEmissions,
            List<ResultRow> ambientAir,
            List<WastewaterResultRow> wastewater,
            List<ResultRow> water,
            List<ResultRow> soil,
            List<ResultRow> radiation,
            List<WastewaterResultRow> marine
    ) {
    }

    /** Generic row shape - instrumentalMeasurements/ambientAir/water/soil/radiation. */
    public record ResultRow(
            Long controlItemId,
            Long monitoringPointId,
            String pointName,
            String indicatorName,
            String indicatorCode,
            String measurementDate,
            String measurementMethod,
            String normativeValue,
            String actualValue,
            String unit,
            boolean exceedance,
            String exceedanceRatio,
            String correctiveAction,
            String protocolNumber,
            Long protocolId,
            Long protocolResultId
    ) {
    }

    /** emissions/calculatedEmissions row shape - source + г/с + т/год. */
    public record EmissionResultRow(
            Long emissionSourceId,
            String sourceName,
            String indicatorName,
            String indicatorCode,
            String normativeGs,
            String normativeTonsYear,
            String actualGs,
            String actualTonsQuarter,
            String actualTonsYear,
            boolean exceedance,
            String correctiveAction,
            Long protocolId,
            Long protocolResultId,
            /** Item 4: resolved from a batch join (Protocol lookup by id set), not a per-row
             *  findById - see PekOfficialReportDataService. Null when protocolId is null. */
            String protocolNumber
    ) {
    }

    /** calculatedEmissions row shape (item 5) - same source/pollutant/norm/actual/exceedance
     *  columns as EmissionResultRow plus the extra fields the calculated-emissions official table
     *  requires. Kept as its own DTO rather than overloading EmissionResultRow, since the general
     *  row shape can no longer represent this table correctly (module fix item 5). */
    public record CalculatedEmissionResultRow(
            Long emissionSourceId,
            String sourceName,
            String indicatorName,
            String indicatorCode,
            String normativeGs,
            String normativeTonsYear,
            String actualGs,
            String actualTonsQuarter,
            String actualTonsYear,
            boolean exceedance,
            String correctiveAction,
            Long protocolId,
            Long protocolResultId,
            String protocolNumber,
            String calculationMethod,
            String rawMaterialName,
            String rawMaterialConsumptionTons,
            String equipmentOperatingHours
    ) {
    }

    /** wastewater/marine row shape - outlet + concentration + т/год. */
    public record WastewaterResultRow(
            Long waterOutletId,
            String outletName,
            String indicatorName,
            String indicatorCode,
            String normativeValue,
            String normativeUnit,
            String normativeTonsYear,
            String actualValue,
            String actualTonsQuarter,
            String actualTonsYear,
            boolean exceedance,
            String correctiveAction,
            Long protocolId,
            Long protocolResultId,
            /** Item 4: same batch-join treatment as EmissionResultRow.protocolNumber. */
            String protocolNumber
    ) {
    }

    /** Legacy: used by PekProgramService (protocol linking from the report side).
     *  See CreateProtocolPekLinkRequest for the primary protocol-initiated flow. */
    public record CreateProtocolSourceRequest(
            Long protocolId,
            Long programId,
            Long controlItemId,
            Long controlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId
    ) {}

    /** Primary protocol-initiated link creation: called from ProtocolController
     *  when creating a draft protocol with PEK context. Supports full context including
     *  order details and client-side idempotency tracking via clientLinkId. */
    public record CreateProtocolPekLinkRequest(
            Long pekProgramId,
            Long pekReportId,
            Long pekControlItemId,
            /** The specific PekProgramIndicator this protocol measures - stored on the canonical
             *  link row. Must belong to pekControlItemId and to the resolved program. */
            Long programIndicatorId,
            Long pekControlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            String orderId,
            String orderServiceItemId,
            String clientLinkId
    ) {}

    /** Update to an existing PEK link - allows modifying order context and PEK references
     *  without changing the fundamental protocol-report connection. */
    public record UpdateProtocolPekLinkRequest(
            Long pekControlItemId,
            Long programIndicatorId,
            Long pekControlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            String orderId,
            String orderServiceItemId
    ) {}

    public record ProtocolLinkResponse(
            Long id,
            Long reportId,
            Long programId,
            Long protocolId,
            Long controlItemId,
            Long programIndicatorId,
            Long controlEventId,
            Long monitoringPointId,
            Long emissionSourceId,
            Long waterOutletId,
            String orderId,
            String orderServiceItemId,
            String requirementKey,
            String matchType,
            String matchStatus,
            String createdAt,
            Long version
    ) {}

    // --- Iteration 3: final-report document generation & signing --------------------------------

    /** Module fix item 3: sourceContentRevision/currentContentRevision/stale expose the same
     *  staleness check PekReportContentRevisionService#requireCurrent enforces server-side at
     *  download/sign time - so a client can show "this document is outdated" before the user even
     *  tries to download/sign it, instead of only discovering it via a 409 PEK_DOCUMENT_STALE. */
    public record PekReportDocumentVersionResponse(
            Long id,
            Long reportId,
            int version,
            /** OFFICIAL (state-facing regulatory report) or INTERNAL (CRM analytical report) -
             *  two separate products; a client must never treat an INTERNAL version as the
             *  official document. */
            String documentType,
            boolean hasDocx,
            boolean hasPdf,
            String sha256,
            String generatedAt,
            Long generatedBy,
            String generatedByName,
            Long sourceContentRevision,
            Long currentContentRevision,
            boolean stale
    ) {}

    public record SignPekReportRequest(String cms) {}

    /** Body for POST /reports/{id}/reject - rejectionReason is mandatory server-side. */
    public record RejectReportRequest(String rejectionReason) {}

    public record PekReportSignatureResponse(
            Long id,
            Long reportId,
            Long documentVersionId,
            Long signerUserId,
            String signedAt,
            String documentHash,
            String signatureType,
            String certificateSubject,
            String certificateCn,
            String certificateSerial,
            String certificateOrganization,
            boolean verified
    ) {}

    /** Iteration 4: result of a scheduler pass (scheduled or manual re-run) - see
     *  PekCollectionScheduler / PekSchedulerRunLog. */
    public record SchedulerRunLogResponse(
            Long id,
            String jobName,
            String status,
            String startedAt,
            String finishedAt,
            int processedCount,
            int errorCount,
            String errorSummary,
            String triggeredBy
    ) {}
}
