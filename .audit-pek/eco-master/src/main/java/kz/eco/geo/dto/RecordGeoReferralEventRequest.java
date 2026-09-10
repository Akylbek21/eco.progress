package kz.eco.geo.dto;

import java.time.LocalDate;

public record RecordGeoReferralEventRequest(
        String source,
        String medium,
        String landingPage,
        int sessions,
        int conversions,
        int leadCount,
        LocalDate periodStart,
        LocalDate periodEnd
) {
}
