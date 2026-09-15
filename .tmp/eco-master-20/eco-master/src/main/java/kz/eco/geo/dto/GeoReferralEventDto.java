package kz.eco.geo.dto;

import kz.eco.geo.GeoReferralEvent;

import java.time.LocalDate;

public record GeoReferralEventDto(
        Long id,
        String source,
        String medium,
        String landingPage,
        int sessions,
        int conversions,
        int leadCount,
        LocalDate periodStart,
        LocalDate periodEnd
) {
    public static GeoReferralEventDto from(GeoReferralEvent e) {
        return new GeoReferralEventDto(e.getId(), e.getSource().name(), e.getMedium(), e.getLandingPage(),
                e.getSessions(), e.getConversions(), e.getLeadCount(), e.getPeriodStart(), e.getPeriodEnd());
    }
}
