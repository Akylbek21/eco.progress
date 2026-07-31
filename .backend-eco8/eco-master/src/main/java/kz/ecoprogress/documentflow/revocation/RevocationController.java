package kz.ecoprogress.documentflow.revocation;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/document-flow")
public class RevocationController {

    private final RevocationService service;

    public RevocationController(RevocationService service) {
        this.service = service;
    }

    @PostMapping("/documents/{id}/revocation-requests")
    public ApiResponse<RevocationDtos.RevocationResponse> create(
            @PathVariable Long id, @RequestBody RevocationDtos.CreateRevocationRequest request) {
        return ApiResponse.ok(RevocationDtos.RevocationResponse.from(
                service.create(id, request.reason(), CurrentUser.get().getId())));
    }

    @GetMapping("/documents/{id}/revocation-requests")
    public ApiResponse<List<RevocationDtos.RevocationResponse>> history(@PathVariable Long id) {
        return ApiResponse.ok(service.history(id, CurrentUser.get().getId()).stream()
                .map(RevocationDtos.RevocationResponse::from).toList());
    }

    @PostMapping("/revocation-requests/{requestId}/send")
    public ApiResponse<RevocationDtos.RevocationResponse> send(@PathVariable Long requestId) {
        return ApiResponse.ok(RevocationDtos.RevocationResponse.from(service.send(requestId, CurrentUser.get().getId())));
    }

    @PostMapping("/revocation-requests/{requestId}/approve")
    public ApiResponse<RevocationDtos.RevocationResponse> approve(
            @PathVariable Long requestId, @RequestBody(required = false) RevocationDtos.ResolveRevocationRequest request) {
        String comment = request != null ? request.comment() : null;
        return ApiResponse.ok(RevocationDtos.RevocationResponse.from(
                service.approve(requestId, comment, CurrentUser.get().getId())));
    }

    @PostMapping("/revocation-requests/{requestId}/reject")
    public ApiResponse<RevocationDtos.RevocationResponse> reject(
            @PathVariable Long requestId, @RequestBody(required = false) RevocationDtos.ResolveRevocationRequest request) {
        String comment = request != null ? request.comment() : null;
        return ApiResponse.ok(RevocationDtos.RevocationResponse.from(
                service.reject(requestId, comment, CurrentUser.get().getId())));
    }

    @PostMapping("/revocation-requests/{requestId}/cancel")
    public ApiResponse<RevocationDtos.RevocationResponse> cancel(@PathVariable Long requestId) {
        return ApiResponse.ok(RevocationDtos.RevocationResponse.from(service.cancel(requestId, CurrentUser.get().getId())));
    }
}
