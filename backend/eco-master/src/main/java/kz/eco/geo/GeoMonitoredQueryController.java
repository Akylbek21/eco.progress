package kz.eco.geo;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.geo.dto.CreateGeoMonitoredQueryRequest;
import kz.eco.geo.dto.GeoMonitoredQueryDto;
import kz.eco.geo.dto.RecordCheckRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** GEO Query Monitor admin API (Analytics item 3). Admin-only. */
@RestController
@RequestMapping("/api/admin/analytics/geo-queries")
@PreAuthorize(SecurityExpressions.ADMIN_ONLY)
public class GeoMonitoredQueryController {

    private final GeoMonitoredQueryService service;

    public GeoMonitoredQueryController(GeoMonitoredQueryService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<GeoMonitoredQueryDto>> list() {
        return ApiResponse.ok(service.findAll());
    }

    @PostMapping
    public ApiResponse<GeoMonitoredQueryDto> create(@RequestBody CreateGeoMonitoredQueryRequest request) {
        return ApiResponse.ok(service.create(request), "Запрос добавлен в мониторинг");
    }

    @PostMapping("/{id}/record-check")
    public ApiResponse<GeoMonitoredQueryDto> recordCheck(@PathVariable Long id, @RequestBody RecordCheckRequest request) {
        return ApiResponse.ok(service.recordCheck(id, request, CurrentUser.get()), "Результат проверки сохранён");
    }
}
