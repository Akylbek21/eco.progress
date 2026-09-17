package kz.eco.pek.dto;

import java.util.List;
import java.util.Map;

public final class PekMonitoringDtos {
    private PekMonitoringDtos() {}

    public record Request(String monitoringType, String name, String methodology, Long laboratoryId,
                          String frequencyType, Integer plannedCount, List<Long> controlItemIds,
                          Boolean active) {}

    public record Response(Long id, Long programId, String monitoringType, String name, String methodology,
                           Long laboratoryId, String frequencyType, Integer plannedCount,
                           List<Long> controlItemIds, List<String> protocolTypes,
                           List<String> missingFields, boolean active, Long version,
                           Map<String, Boolean> availableActions) {}

    /** GET /api/pek/programs/{id}/monitoring - module fix: previously a bare List<Response>, giving
     *  the frontend no programId echo or list-level availableActions (e.g. "can I even add a new
     *  monitoring direction right now" without inspecting program status/role itself). */
    public record ListResponse(Long programId, List<Response> items, Map<String, Boolean> availableActions) {}

    /**
     * One thing that keeps a document or the package from being complete.
     *
     * @param code     stable machine code, e.g. DOCUMENT_MISSING, PROTOCOL_PDF_MISSING, NORMATIVE_REQUIRED
     * @param section  where to fix it: DOCUMENTS, PROTOCOLS, EXPLANATORY_NOTE, MEASURES, EMISSIONS, GENERAL
     * @param entityId the offending row (protocol id, measure id, emission source id), when there is one
     * @param field    the exact field to fill, when the issue is about one field
     * @param message  human-readable Russian text - what the frontend shows, never a field path
     */
    public record PackageIssue(String code, String section, Long entityId, String field, String message) {}

    /**
     * One planned entry of the package and its current state.
     *
     * @param key          stable id of the entry (PROGRAM_DOCX, OFFICIAL_PDF, PROTOCOL_12_PDF...)
     * @param path         the path it has (or will have) inside the ZIP
     * @param title        human-readable name for the checklist
     * @param documentType PekReportDocumentType for report documents, PROGRAM / PROTOCOL otherwise
     * @param format       DOCX / PDF / XLSX
     * @param status       READY, MISSING or STALE
     * @param versionId    PekReportDocumentVersion id (report documents) or protocol id
     */
    public record PackageFile(String key, String path, String title, String documentType, String format,
                              boolean required, String status, Long versionId, Integer documentVersion,
                              Long sourceContentRevision, String generatedAt, Long generatedBy) {}

    /**
     * GET /api/pek/reports/{id}/package/preflight - what a package built right now would contain,
     * computed from current data without writing anything. {@code ready} is exactly the condition
     * POST .../generate enforces: when false, generate answers 409 PEK_PACKAGE_NOT_READY with the
     * same {@code issues}.
     */
    public record PreflightResponse(Long reportId, Long currentContentRevision, boolean ready,
                                    List<PackageFile> files, List<PackageIssue> missingDocuments,
                                    List<PackageIssue> staleDocuments, List<PackageIssue> issues,
                                    Map<String, Boolean> availableActions) {}

    /**
     * One built package.
     *
     * @param documentVersion         how many packages have been built for this report (1, 2, 3...).
     *                                Unrelated to {@link #version} and to sourceContentRevision.
     * @param sourceContentRevision   the report's contentRevision at build time; the package is
     *                                stale (and undownloadable) once the report's has moved past it.
     * @param files                   the archive's manifest - exactly the entries the ZIP contains.
     * @param missingFields           kept for backward compatibility. A package is only ever built
     *                                complete now (see POST .../generate), so for a new package it is
     *                                empty; older packages keep what they recorded.
     * @param missingDocuments        required documents absent RIGHT NOW (live, not a build snapshot).
     * @param staleDocuments          documents rendered from an older revision of the data, right now.
     * @param readiness               every current issue, including missing/stale documents.
     * @param version                 the package row's own optimistic-lock version. NOT the value to
     *                                send as If-Match when generating - that is the REPORT's version.
     */
    public record PackageResponse(Long id, Long reportId, Integer documentVersion, Long sourceContentRevision,
                                  List<String> files, List<String> missingFields, String generatedAt,
                                  Long generatedBy, boolean downloadAvailable,
                                  Map<String, Boolean> availableActions, Long version,
                                  List<PackageIssue> missingDocuments, List<PackageIssue> staleDocuments,
                                  List<PackageIssue> readiness) {}
}
