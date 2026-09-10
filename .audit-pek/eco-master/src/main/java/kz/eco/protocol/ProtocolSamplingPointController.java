package kz.eco.protocol;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Sampling-point sub-resource under /api/protocols/{id}/sampling-points.
 *
 * <p>Access follows the same two-axis model as the rest of the protocol module:
 * scope (IDOR prevention via ProtocolAccessService) and tier (role/status/action via
 * ProtocolMutationGuard). All mutations require the protocol to be in an editable status.
 *
 * <p>Version is passed via the standard If-Match header on PATCH and DELETE (fallback to
 * request body field when the header is absent, for backward-compat with any legacy callers).
 */
@RestController
@RequestMapping("/api/protocols/{protocolId}/sampling-points")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class ProtocolSamplingPointController {

    private final ProtocolSamplingPointService service;

    public ProtocolSamplingPointController(ProtocolSamplingPointService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize(SecurityExpressions.PROTOCOL_VIEW)
    public ApiResponse<List<ProtocolApiDtos.SamplingPointResponse>> list(@PathVariable Long protocolId) {
        return ApiResponse.ok(service.list(protocolId, CurrentUser.get().getId()));
    }

    @PostMapping
    public ApiResponse<ProtocolApiDtos.SamplingPointResponse> create(
            @PathVariable Long protocolId,
            @RequestHeader("If-Match") Long version,
            @RequestBody ProtocolApiDtos.SamplingPointRequest request) {
        return ApiResponse.ok(
                service.create(protocolId, request, version, CurrentUser.get().getId()),
                "Точка отбора добавлена");
    }

    /** Version via If-Match header; fallback to request body.version when header absent. */
    @PatchMapping("/{pointId}")
    public ApiResponse<ProtocolApiDtos.SamplingPointResponse> update(
            @PathVariable Long protocolId,
            @PathVariable Long pointId,
            @RequestHeader("If-Match") Long ifMatch,
            @RequestBody ProtocolApiDtos.SamplingPointRequest request) {
        return ApiResponse.ok(
                service.update(protocolId, pointId, ifMatch, request, CurrentUser.get().getId()),
                "Точка отбора обновлена");
    }

    @DeleteMapping("/{pointId}")
    public ApiResponse<Void> delete(
            @PathVariable Long protocolId,
            @PathVariable Long pointId,
            @RequestHeader("If-Match") Long version) {
        service.delete(protocolId, pointId, version, CurrentUser.get().getId());
        return ApiResponse.ok(null, "Точка отбора удалена");
    }

    /**
     * Bulk-copies indicator metadata (name, unit, normativeId, method) from one point's results
     * to all target points as new result rows, WITHOUT copying measured values. Idempotent in
     * intent: the operator can call it multiple times; each call appends new rows.
     */
    @PostMapping("/copy-indicators")
    public ApiResponse<Integer> copyIndicators(
            @PathVariable Long protocolId,
            @RequestHeader("If-Match") Long version,
            @RequestBody ProtocolApiDtos.CopyIndicatorsRequest request) {
        int copied = service.copyIndicators(protocolId, version, request, CurrentUser.get().getId());
        return ApiResponse.ok(copied, "Скопировано строк результатов: " + copied);
    }
}
