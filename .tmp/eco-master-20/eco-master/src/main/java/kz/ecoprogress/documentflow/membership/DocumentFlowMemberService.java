package kz.ecoprogress.documentflow.membership;

import kz.eco.audit.AuditLog;
import kz.eco.audit.AuditLogRepository;
import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.mail.EmailEvent;
import kz.eco.mail.EmailOutboxService;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserStatus;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Simple employee-access management for the document-flow module (spec: "администратор должен
 * иметь возможность предоставить доступ по email без ручной работы в БД"). Deliberately restricted
 * to the four simple roles a first-stage internal rollout needs (OWNER/DOCUMENT_MANAGER/SIGNER/
 * VIEWER) - MembershipRole has more (DOCUMENT_FLOW_ADMIN/ACCOUNTANT/EXTERNAL_SIGNER) for other
 * flows, but this API only ever assigns one of the four so the UI stays a single dropdown, not a
 * permissions matrix.
 */
@Service
public class DocumentFlowMemberService {

    /** The only roles this API will assign - not all of MembershipRole (module spec §6: "не
     *  создавать десятки сложных permission-настроек в интерфейсе первого этапа"). */
    private static final Set<MembershipRole> ASSIGNABLE_ROLES =
            Set.of(MembershipRole.OWNER, MembershipRole.DOCUMENT_MANAGER, MembershipRole.SIGNER, MembershipRole.VIEWER);

    private final DocumentFlowMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final DocumentFlowAccessService accessService;
    private final AuditLogService auditLogService;
    private final AuditLogRepository auditLogRepository;
    private final MembershipInvitationService invitationService;
    private final EmailOutboxService emailOutboxService;

    private static final String ENTITY_TYPE = "DocumentFlowMembership";

    public DocumentFlowMemberService(DocumentFlowMembershipRepository membershipRepository,
                                      UserRepository userRepository,
                                      DocumentFlowAccessService accessService,
                                      AuditLogService auditLogService,
                                      AuditLogRepository auditLogRepository,
                                      MembershipInvitationService invitationService,
                                      EmailOutboxService emailOutboxService) {
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.accessService = accessService;
        this.auditLogService = auditLogService;
        this.auditLogRepository = auditLogRepository;
        this.invitationService = invitationService;
        this.emailOutboxService = emailOutboxService;
    }

    @Transactional(readOnly = true)
    public List<DocumentFlowMembership> list(Long userId, Long organizationId) {
        accessService.requireActiveAccess(userId, organizationId);
        return membershipRepository.findByOrganizationIdAndStatusNot(organizationId, MembershipStatus.REMOVED);
    }

    @Transactional
    public DocumentFlowMembership create(Long actorUserId, Long organizationId, String email, String roleRaw) {
        requireManageMembers(actorUserId, organizationId);
        MembershipRole role = parseAssignableRole(roleRaw);

        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isEmpty()) {
            throw new BadRequestException("Укажите email сотрудника");
        }
        User target = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseThrow(() -> new NotFoundException(
                "Пользователь с указанным email не найден. Сначала зарегистрируйте пользователя или отправьте приглашение.",
                "MEMBER_NOT_FOUND"));

        DocumentFlowMembership membership = membershipRepository.findByOrganizationIdAndUserId(organizationId, target.getId())
                .orElseGet(() -> {
                    DocumentFlowMembership created = new DocumentFlowMembership();
                    created.setOrganizationId(organizationId);
                    created.setUserId(target.getId());
                    created.setInvitedBy(actorUserId);
                    return created;
                });
        boolean isNew = membership.getId() == null;
        MembershipRole previousRole = membership.getRoleCode();
        membership.setRoleCode(role);
        membership.setStatus(MembershipStatus.ACTIVE);
        if (membership.getJoinedAt() == null) {
            membership.setJoinedAt(LocalDateTime.now());
        }
        membershipRepository.save(membership);

        if (isNew) {
            audit(membership, actorUserId, "MEMBER_ACCESS_GRANTED",
                    null, role.name(), "Доступ предоставлен: " + normalizedEmail);
        } else if (previousRole != role) {
            audit(membership, actorUserId, "MEMBER_ROLE_CHANGED",
                    previousRole != null ? previousRole.name() : null, role.name(), null);
        } else {
            audit(membership, actorUserId, "MEMBER_ACTIVATED", null, role.name(), "Повторная выдача доступа");
        }
        return membership;
    }

    @Transactional
    public DocumentFlowMembership updateRole(Long actorUserId, Long organizationId, Long memberId, String roleRaw) {
        requireManageMembers(actorUserId, organizationId);
        MembershipRole role = parseAssignableRole(roleRaw);
        DocumentFlowMembership membership = getInOrganization(organizationId, memberId);
        MembershipRole previousRole = membership.getRoleCode();
        membership.setRoleCode(role);
        membershipRepository.save(membership);
        if (previousRole != role) {
            audit(membership, actorUserId, "MEMBER_ROLE_CHANGED",
                    previousRole != null ? previousRole.name() : null, role.name(), null);
        }
        return membership;
    }

    @Transactional
    public DocumentFlowMembership activate(Long actorUserId, Long organizationId, Long memberId) {
        requireManageMembers(actorUserId, organizationId);
        DocumentFlowMembership membership = getInOrganization(organizationId, memberId);
        membership.setStatus(MembershipStatus.ACTIVE);
        if (membership.getJoinedAt() == null) {
            membership.setJoinedAt(LocalDateTime.now());
        }
        membershipRepository.save(membership);
        audit(membership, actorUserId, "MEMBER_ACTIVATED", null, null, null);
        return membership;
    }

    @Transactional
    public DocumentFlowMembership deactivate(Long actorUserId, Long organizationId, Long memberId) {
        requireManageMembers(actorUserId, organizationId);
        DocumentFlowMembership membership = getInOrganization(organizationId, memberId);
        if (membership.getUserId().equals(actorUserId)) {
            throw new BadRequestException("Нельзя деактивировать собственный доступ");
        }
        membership.setStatus(MembershipStatus.SUSPENDED);
        membershipRepository.save(membership);
        audit(membership, actorUserId, "MEMBER_DEACTIVATED", null, null, null);
        return membership;
    }

    /** Invite-by-email flow (module spec item 2): unlike {@link #create}, the target user need not
     *  already exist (a minimal pending_setup placeholder account is created if needed) and the
     *  membership starts as INVITED, not ACTIVE - it only becomes ACTIVE once the invitee accepts
     *  via {@link MembershipInvitationService#accept}. */
    @Transactional
    public MembershipInvitationService.Created invite(Long actorUserId, Long organizationId, String email, String roleRaw) {
        requireManageMembers(actorUserId, organizationId);
        MembershipRole role = parseAssignableRole(roleRaw);

        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isEmpty()) {
            throw new BadRequestException("Укажите email сотрудника");
        }

        User target = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(() -> {
            User created = new User();
            created.setEmail(normalizedEmail);
            created.setPasswordHash(null);
            created.setStatus(UserStatus.pending_setup);
            return userRepository.save(created);
        });

        DocumentFlowMembership membership = membershipRepository.findByOrganizationIdAndUserId(organizationId, target.getId())
                .orElseGet(() -> {
                    DocumentFlowMembership created = new DocumentFlowMembership();
                    created.setOrganizationId(organizationId);
                    created.setUserId(target.getId());
                    return created;
                });
        if (membership.getStatus() == MembershipStatus.ACTIVE) {
            throw new ConflictException("Пользователь уже является активным участником", "MEMBER_ALREADY_ACTIVE");
        }
        membership.setRoleCode(role);
        membership.setStatus(MembershipStatus.INVITED);
        membership.setInvitedBy(actorUserId);
        membershipRepository.save(membership);

        MembershipInvitationService.Created created = invitationService.create(membership, target, actorUserId);
        sendInvitationEmail(target, created.rawToken());
        audit(membership, actorUserId, "MEMBER_INVITED", null, role.name(), "Приглашение отправлено: " + normalizedEmail);
        return created;
    }

    @Transactional
    public MembershipInvitationService.Created resendInvite(Long actorUserId, Long organizationId, Long memberId) {
        requireManageMembers(actorUserId, organizationId);
        DocumentFlowMembership membership = getInOrganization(organizationId, memberId);
        if (membership.getStatus() != MembershipStatus.INVITED) {
            throw new BadRequestException("Повторно отправить приглашение можно только для статуса INVITED",
                    "MEMBER_NOT_INVITED");
        }
        User target = userRepository.findById(membership.getUserId())
                .orElseThrow(() -> new NotFoundException("Пользователь не найден", "MEMBER_NOT_FOUND"));
        MembershipInvitationService.Created created = invitationService.create(membership, target, actorUserId);
        sendInvitationEmail(target, created.rawToken());
        audit(membership, actorUserId, "MEMBER_INVITE_RESENT", null, null, null);
        return created;
    }

    private void sendInvitationEmail(User target, String rawToken) {
        emailOutboxService.enqueue(target.getEmail(), "Приглашение в систему документооборота",
                "Для принятия приглашения перейдите по ссылке: "
                        + "/api/public/document-flow/invitations/" + rawToken + "/accept",
                EmailEvent.DOCUMENT_FLOW_MEMBER_INVITED, null);
    }

    @Transactional
    public DocumentFlowMembership remove(Long actorUserId, Long organizationId, Long memberId) {
        requireManageMembers(actorUserId, organizationId);
        DocumentFlowMembership membership = getInOrganization(organizationId, memberId);
        if (membership.getUserId().equals(actorUserId)) {
            throw new BadRequestException("Нельзя удалить собственный доступ");
        }
        MembershipStatus previous = membership.getStatus();
        membership.setStatus(MembershipStatus.REMOVED);
        membershipRepository.save(membership);
        audit(membership, actorUserId, "MEMBER_REMOVED", previous.name(), MembershipStatus.REMOVED.name(), null);
        return membership;
    }

    @Transactional(readOnly = true)
    public List<AuditLog> auditLog(Long actorUserId, Long organizationId, Long memberId) {
        accessService.requireActiveAccess(actorUserId, organizationId);
        if (!accessService.hasPermission(actorUserId, organizationId, DocumentFlowPermission.VIEW_AUDIT_LOG)) {
            throw new ForbiddenException("Недостаточно прав для просмотра журнала", "MEMBER_AUDIT_FORBIDDEN");
        }
        DocumentFlowMembership membership = getInOrganization(organizationId, memberId);
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(ENTITY_TYPE, membership.getId());
    }

    private DocumentFlowMembership getInOrganization(Long organizationId, Long memberId) {
        DocumentFlowMembership membership = membershipRepository.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден", "MEMBER_NOT_FOUND"));
        if (!membership.getOrganizationId().equals(organizationId)) {
            // Same "don't confirm the row exists in a different tenant" posture as the rest of the
            // module - a 404 here, not a 403 that would leak "this id exists, just not for you".
            throw new NotFoundException("Сотрудник не найден", "MEMBER_NOT_FOUND");
        }
        return membership;
    }

    /** Module spec §11: only OWNER/ADMIN can manage member access - MANAGE_MEMBERS is exactly
     *  OWNER's (and DOCUMENT_FLOW_ADMIN's) permission, and a system ADMIN reaches OWNER through
     *  OrganizationResolver's auto-provisioning, so checking this one permission covers both. */
    private void requireManageMembers(Long userId, Long organizationId) {
        accessService.requireActiveAccess(userId, organizationId);
        if (!accessService.hasPermission(userId, organizationId, DocumentFlowPermission.MANAGE_MEMBERS)) {
            throw new ForbiddenException("Недостаточно прав для управления сотрудниками", "MEMBER_MANAGE_FORBIDDEN");
        }
    }

    private static MembershipRole parseAssignableRole(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Укажите role", "MEMBER_ROLE_INVALID");
        }
        MembershipRole role;
        try {
            role = MembershipRole.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимая роль: " + raw, "MEMBER_ROLE_INVALID");
        }
        if (!ASSIGNABLE_ROLES.contains(role)) {
            throw new BadRequestException(
                    "Роль " + role + " нельзя назначить через это API - допустимы OWNER, DOCUMENT_MANAGER, SIGNER, VIEWER",
                    "MEMBER_ROLE_INVALID");
        }
        return role;
    }

    private void audit(DocumentFlowMembership membership, Long actorUserId, String actionType,
                        String oldValue, String newValue, String comment) {
        User actor = userRepository.findById(actorUserId).orElse(null);
        auditLogService.log(ENTITY_TYPE, membership.getId(), null, actor, actionType, oldValue, newValue, comment);
    }
}
