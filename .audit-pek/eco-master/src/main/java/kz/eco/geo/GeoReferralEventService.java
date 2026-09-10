package kz.eco.geo;

import kz.eco.common.exception.BadRequestException;
import kz.eco.geo.dto.GeoReferralEventDto;
import kz.eco.geo.dto.RecordGeoReferralEventRequest;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Manual/API-fed GEO referral tracking (Analytics item 2) - deliberately not an automated
 *  scraper of ChatGPT/Google; results are recorded here from an allowed source (GA4/GSC export,
 *  manual entry) and kept in their own {@link GeoReferralSource} bucket, never blended with the
 *  ordinary Google-organic KPI. */
@Service
public class GeoReferralEventService {

    private final GeoReferralEventRepository repository;

    public GeoReferralEventService(GeoReferralEventRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<GeoReferralEventDto> findAll(GeoReferralSource source) {
        List<GeoReferralEvent> events = source == null
                ? repository.findAllByOrderByPeriodStartDesc()
                : repository.findAllBySourceOrderByPeriodStartDesc(source);
        return events.stream().map(GeoReferralEventDto::from).toList();
    }

    @Transactional
    public GeoReferralEventDto record(RecordGeoReferralEventRequest request, User actor) {
        GeoReferralSource source = parseSource(request.source());
        if (request.landingPage() == null || request.landingPage().isBlank()) {
            throw new BadRequestException("Укажите landingPage", "LANDING_PAGE_REQUIRED");
        }
        if (request.periodStart() == null || request.periodEnd() == null) {
            throw new BadRequestException("Укажите период (periodStart/periodEnd)", "PERIOD_REQUIRED");
        }
        GeoReferralEvent e = new GeoReferralEvent();
        e.setSource(source);
        e.setMedium(request.medium());
        e.setLandingPage(request.landingPage());
        e.setSessions(request.sessions());
        e.setConversions(request.conversions());
        e.setLeadCount(request.leadCount());
        e.setPeriodStart(request.periodStart());
        e.setPeriodEnd(request.periodEnd());
        e.setRecordedBy(actor.getId());
        e.setRecordedAt(Instant.now());
        return GeoReferralEventDto.from(repository.save(e));
    }

    private GeoReferralSource parseSource(String value) {
        try {
            return GeoReferralSource.valueOf(value);
        } catch (Exception ex) {
            throw new BadRequestException("Неизвестный источник: " + value, "UNKNOWN_SOURCE");
        }
    }
}
