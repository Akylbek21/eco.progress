package kz.ecoprogress.documentflow.membership;

import kz.eco.audit.AuditLog;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.ecoprogress.documentflow.access.OrganizationResolver;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Simple internal-mode employee-access management (module spec §5/§7): grant/change/deactivate a
 * colleague's document-flow access by email and one of the four simple roles, no BIN/organization
 * bookkeeping required from the caller - {@link OrganizationResolver} resolves which organization
 * this means exactly like every other document-flow controller.
 */
@RestController
@RequestMapping("/api/document-flow/members")
public class DocumentFlowMemberController {

    private final DocumentFlowMemberService memberService;
    private final OrganizationResolver organizationResolver;
    private final UserRepository userRepository;

    public DocumentFlowMemberController(DocumentFlowMemberService memberService,
                                         OrganizationResolver organizationResolver,
                                         UserRepository userRepository) {
        this.memberService = memberService;
        this.organizationResolver = organizationResolver;
        this.userRepository = userRepository;
    }

    public record CreateMemberRequest(String email, String role) {
    }

    public record UpdateMemberRequest(String role) {
    }

    public record InviteMemberRequest(String email, String role) {
    }

    public record AuditLogDto(String actionType, Long actorUserId, String actorRole,
                               String oldValue, String newValue, String comment, LocalDateTime createdAt) {
        static AuditLogDto from(AuditLog log) {
            return new AuditLogDto(log.getActionType(), log.getActorUserId(), log.getActorRole(),
                    log.getOldValue(), log.getNewValue(), log.getComment(), log.getCreatedAt());
        }
    }

    public record DocumentFlowMemberDto(Long id, Long userId, String fullName, String email, String role, String status) {
        static DocumentFlowMemberDto from(DocumentFlowMembership membership, User user) {
            return new DocumentFlowMemberDto(
                    membership.getId(),
                    membership.getUserId(),
                    user != null ? user.getName() : null,
                    user != null ? user.getEmail() : null,
                    membership.getRoleCode() != null ? membership.getRoleCode().name() : null,
                    membership.getStatus().name());
        }
    }

    private DocumentFlowMemberDto toDto(DocumentFlowMembership membership) {
        User user = userRepository.findById(membership.getUserId()).orElse(null);
        return DocumentFlowMemberDto.from(membership, user);
    }

    @GetMapping
    public ApiResponse<List<DocumentFlowMemberDto>> list(@RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        List<DocumentFlowMemberDto> members = memberService.list(user.getId(), resolvedOrgId).stream()
                .map(this::toDto)
                .toList();
        return ApiResponse.ok(members);
    }

    @PostMapping
    public ApiResponse<DocumentFlowMemberDto> create(@RequestParam(required = false) Long organizationId,
                                                      @RequestBody CreateMemberRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        DocumentFlowMembership membership = memberService.create(user.getId(), resolvedOrgId, request.email(), request.role());
        return ApiResponse.ok(toDto(membership), "Доступ предоставлен");
    }

    @PatchMapping("/{memberId}")
    public ApiResponse<DocumentFlowMemberDto> updateRole(@PathVariable Long memberId,
                                                          @RequestParam(required = false) Long organizationId,
                                                          @RequestBody UpdateMemberRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        DocumentFlowMembership membership = memberService.updateRole(user.getId(), resolvedOrgId, memberId, request.role());
        return ApiResponse.ok(toDto(membership), "Роль изменена");
    }

    @PostMapping("/{memberId}/activate")
    public ApiResponse<DocumentFlowMemberDto> activate(@PathVariable Long memberId,
                                                        @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        DocumentFlowMembership membership = memberService.activate(user.getId(), resolvedOrgId, memberId);
        return ApiResponse.ok(toDto(membership), "Доступ активирован");
    }

    @PostMapping("/{memberId}/deactivate")
    public ApiResponse<DocumentFlowMemberDto> deactivate(@PathVariable Long memberId,
                                                          @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        DocumentFlowMembership membership = memberService.deactivate(user.getId(), resolvedOrgId, memberId);
        return ApiResponse.ok(toDto(membership), "Доступ деактивирован");
    }

    @PostMapping("/invite")
    public ApiResponse<Void> invite(@RequestParam(required = false) Long organizationId,
                                     @RequestBody InviteMemberRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        memberService.invite(user.getId(), resolvedOrgId, request.email(), request.role());
        return ApiResponse.message("Приглашение отправлено");
    }

    @PostMapping("/{memberId}/resend-invite")
    public ApiResponse<Void> resendInvite(@PathVariable Long memberId,
                                           @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        memberService.resendInvite(user.getId(), resolvedOrgId, memberId);
        return ApiResponse.message("Приглашение отправлено повторно");
    }

    @DeleteMapping("/{memberId}")
    public ApiResponse<Void> remove(@PathVariable Long memberId,
                                     @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        memberService.remove(user.getId(), resolvedOrgId, memberId);
        return ApiResponse.message("Сотрудник удалён");
    }

    @GetMapping("/{memberId}/audit-log")
    public ApiResponse<List<AuditLogDto>> auditLog(@PathVariable Long memberId,
                                                     @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        List<AuditLogDto> entries = memberService.auditLog(user.getId(), resolvedOrgId, memberId).stream()
                .map(AuditLogDto::from)
                .toList();
        return ApiResponse.ok(entries);
    }
}
