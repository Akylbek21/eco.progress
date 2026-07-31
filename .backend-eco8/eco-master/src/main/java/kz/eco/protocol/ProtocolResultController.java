package kz.eco.protocol;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/protocol-results")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class ProtocolResultController {

    private final ProtocolService protocolService;

    public ProtocolResultController(ProtocolService protocolService) {
        this.protocolService = protocolService;
    }

    @PatchMapping("/{resultId}")
    public ApiResponse<Map<String, Object>> update(@PathVariable Long resultId,
                                                   @RequestBody ProtocolApiDtos.ResultRow request) {
        return ApiResponse.ok(protocolService.updateResult(resultId, request, CurrentUser.get().getId()), "Строка обновлена");
    }

    @DeleteMapping("/{resultId}")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> delete(@PathVariable Long resultId) {
        return ApiResponse.ok(protocolService.deleteResult(resultId, CurrentUser.get().getId()), "Строка удалена");
    }
}
