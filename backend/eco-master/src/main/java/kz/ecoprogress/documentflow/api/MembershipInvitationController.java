package kz.ecoprogress.documentflow.api;

import kz.eco.common.ApiResponse;
import kz.ecoprogress.documentflow.membership.MembershipInvitationService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/document-flow/invitations")
public class MembershipInvitationController {
    private final MembershipInvitationService service;
    public MembershipInvitationController(MembershipInvitationService service){this.service=service;}
    public record AcceptRequest(String password){}
    @PostMapping("/{token}/accept")
    public ApiResponse<Long> accept(@PathVariable String token, @RequestBody AcceptRequest request){
        return ApiResponse.ok(service.accept(token, request.password()), "Приглашение принято");
    }

    @PostMapping("/{token}/decline")
    public ApiResponse<Void> decline(@PathVariable String token){
        service.decline(token);
        return ApiResponse.message("Приглашение отклонено");
    }
}
