package kz.eco.geo.dto;

import java.util.List;

/** Result of a manual (or explicitly-allowed API) check of one monitored query - see
 *  GeoMonitoredQueryService#recordCheck. version is mandatory (optimistic locking). */
public record RecordCheckRequest(
        boolean ourBrandMentioned,
        boolean ourUrlCited,
        List<String> competitors,
        Long version
) {
}
