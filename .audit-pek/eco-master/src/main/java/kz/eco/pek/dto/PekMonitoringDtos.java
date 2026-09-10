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
    public record PackageResponse(Long id, Long reportId, Integer documentVersion, Long sourceContentRevision,
                                  List<String> files, List<String> missingFields, String generatedAt,
                                  Long generatedBy, boolean downloadAvailable,
                                  Map<String, Boolean> availableActions, Long version) {}
}
