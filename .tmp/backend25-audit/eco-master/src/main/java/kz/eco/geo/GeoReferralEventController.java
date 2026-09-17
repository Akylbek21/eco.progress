package kz.eco.geo;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.geo.dto.GeoReferralEventDto;
import kz.eco.geo.dto.RecordGeoReferralEventRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** GEO/AI-referral KPI tracking (Analytics items 1-2) - separate source buckets (Google Organic,
 *  Google AI visibility, ChatGPT referrals, Bing/Copilot referrals, AI citations), never blended
 *  into one number. Admin-only. */
@RestController
@RequestMapping("/api/admin/analytics/geo-referrals")
@PreAuthorize(SecurityExpressions.ADMIN_ONLY)
public class GeoReferralEventController {

    private final GeoReferralEventService service;

    public GeoReferralEventController(GeoReferralEventService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<GeoReferralEventDto>> list(@RequestParam(required = false) GeoReferralSource source) {
        return ApiResponse.ok(service.findAll(source));
    }

    @PostMapping
    public ApiResponse<GeoReferralEventDto> record(@RequestBody RecordGeoReferralEventRequest request) {
        return ApiResponse.ok(service.record(request, CurrentUser.get()), "Запись добавлена");
    }
}
