package kz.eco.geo.dto;

public record CreateGeoMonitoredQueryRequest(
        String query,
        String category,
        String serviceId,
        String citySlug,
        String intent
) {
}
