package kz.ecoprogress.documentflow.admin;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.ecoprogress.documentflow.admin.dto.AdminCreateMemberRequest;
import kz.ecoprogress.documentflow.admin.dto.AdminMemberDto;
import kz.ecoprogress.documentflow.admin.dto.AdminUpdateMemberRequest;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static kz.ecoprogress.documentflow.admin.DocumentFlowAdminSecurityExpressions.DOCUMENT_FLOW_MEMBER_MANAGE;

/**
 * Admin-driven member management, explicitly organizationId-from-path (task item 10/16) - see
 * {@link AdminMemberService} javadoc for why this is a separate implementation from the
 * self-service {@code /api/document-flow/members} endpoints rather than a thin wrapper around them.
 */
@RestController
@RequestMapping("/api/admin/document-flow/access/organizations/{organizationId}/members")
@PreAuthorize(DOCUMENT_FLOW_MEMBER_MANAGE)
public class AdminMemberController {

    private final AdminMemberService memberService;
    private final UserRepository userRepository;

    public AdminMemberController(AdminMemberService memberService, UserRepository userRepository) {
        this.memberService = memberService;
        this.userRepository = userRepository;
    }

    private AdminMemberDto toDto(DocumentFlowMembership membership) {
        User user = userRepository.findById(membership.getUserId()).orElse(null);
        return AdminMemberDto.from(membership, user);
    }

    @GetMapping
    public ApiResponse<List<AdminMemberDto>> list(@PathVariable Long organizationId) {
        return ApiResponse.ok(memberService.list(organizationId).stream().map(this::toDto).toList());
    }

    @PostMapping
    public ApiResponse<AdminMemberDto> create(@PathVariable Long organizationId, @Valid @RequestBody AdminCreateMemberRequest request) {
        User actor = CurrentUser.get();
        DocumentFlowMembership membership = memberService.create(actor.getId(), organizationId, request.email(), request.role());
        return ApiResponse.ok(toDto(membership), "Доступ предоставлен");
    }

    @PatchMapping("/{memberId}")
    public ApiResponse<AdminMemberDto> updateRole(@PathVariable Long organizationId, @PathVariable Long memberId,
                                                   @Valid @RequestBody AdminUpdateMemberRequest request) {
        User actor = CurrentUser.get();
        DocumentFlowMembership membership = memberService.updateRole(actor.getId(), organizationId, memberId, request.role());
        return ApiResponse.ok(toDto(membership), "Роль изменена");
    }

    @PostMapping("/{memberId}/activate")
    public ApiResponse<AdminMemberDto> activate(@PathVariable Long organizationId, @PathVariable Long memberId) {
        User actor = CurrentUser.get();
        DocumentFlowMembership membership = memberService.activate(actor.getId(), organizationId, memberId);
        return ApiResponse.ok(toDto(membership), "Доступ активирован");
    }

    @PostMapping("/{memberId}/deactivate")
    public ApiResponse<AdminMemberDto> deactivate(@PathVariable Long organizationId, @PathVariable Long memberId) {
        User actor = CurrentUser.get();
        DocumentFlowMembership membership = memberService.deactivate(actor.getId(), organizationId, memberId);
        return ApiResponse.ok(toDto(membership), "Доступ деактивирован");
    }
}
