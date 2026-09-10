package kz.eco.geo.dto;

import kz.eco.geo.GeoMonitoredQuery;

import java.time.Instant;
import java.util.List;

public record GeoMonitoredQueryDto(
        Long id,
        String query,
        String category,
        String serviceId,
        String citySlug,
        String intent,
        Instant lastCheckedAt,
        boolean ourBrandMentioned,
        boolean ourUrlCited,
        List<String> competitors,
        Long version
) {
    public static GeoMonitoredQueryDto from(GeoMonitoredQuery q) {
        return new GeoMonitoredQueryDto(q.getId(), q.getQuery(), q.getCategory(), q.getServiceId(), q.getCitySlug(),
                q.getIntent().name(), q.getLastCheckedAt(), q.isOurBrandMentioned(), q.isOurUrlCited(),
                List.copyOf(q.getCompetitors()), q.getVersion());
    }
}
