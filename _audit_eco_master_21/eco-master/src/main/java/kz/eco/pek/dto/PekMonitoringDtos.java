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

    /** module fix: sourceReportVersion renamed sourceContentRevision (compared against
     *  PekReport.contentRevision, not the JPA version - see PekReportContentRevisionService), plus
     *  downloadAvailable/availableActions so the frontend never has to guess whether generate/
     *  download would actually succeed. */
    /**
     * One built package.
     *
     * @param documentVersion         how many packages have been built for this report (1, 2, 3...).
     *                                Unrelated to {@link #version} and to sourceContentRevision.
     * @param sourceContentRevision   the report's contentRevision at build time; the package is
     *                                stale (and undownloadable) once the report's has moved past it.
     * @param files                   the archive's manifest - exactly the entries the ZIP contains.
     * @param missingFields           <b>a snapshot of what was missing when THIS package was built,
     *                                not a current readiness check.</b> It describes the archive
     *                                described by {@code generatedAt}/{@code documentVersion} and
     *                                goes stale the moment the underlying data is fixed. It must
     *                                never be used to decide whether generating again is allowed:
     *                                every {@code POST .../package/generate} re-derives these
     *                                complaints from the current data, so correcting the source and
     *                                rebuilding is the intended way to clear them. For the report's
     *                                live readiness use {@code GET /api/pek/reports/{id}/readiness}.
     * @param version                 the package row's own optimistic-lock version. NOT the value to
     *                                send as If-Match when generating - that is the REPORT's version.
     */
    public record PackageResponse(Long id, Long reportId, Integer documentVersion, Long sourceContentRevision,
                                  List<String> files, List<String> missingFields, String generatedAt,
                                  Long generatedBy, boolean downloadAvailable,
                                  Map<String, Boolean> availableActions, Long version) {}
}
