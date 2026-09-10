package kz.ecoprogress.documentflow.admin;

import kz.eco.audit.AuditLogService;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Admin-driven member management for {@code /api/admin/document-flow/access/organizations/
 * {organizationId}/members/**} (task item 10/16). Deliberately does NOT reuse
 * {@link kz.ecoprogress.documentflow.membership.DocumentFlowMemberService}: that service resolves
 * "which organization" via {@code OrganizationResolver}, relative to the CALLING user's own
 * memberships, and gates every action behind that caller having MANAGE_MEMBERS in the target
 * organization - neither makes sense for a platform admin who is very likely not a member of the
 * organization at all. This service instead:
 * <ul>
 *   <li>takes {@code organizationId} directly from the path (never resolved from the caller's own
 *       memberships) and verifies it names a real organization;</li>
 *   <li>verifies every {@code memberId} belongs to that exact {@code organizationId} before any
 *       read or mutation - the IDOR fix task item 18 calls out explicitly: without this check, an
 *       admin (or a bug) could pass an organizationId from the URL that doesn't match the
 *       membership row's real organization and still see/mutate it;</li>
 *   <li>authorization is the controller's {@code @PreAuthorize(DOCUMENT_FLOW_MEMBER_MANAGE)} (a
 *       platform-role check) - there is no per-caller-membership permission check here, unlike
 *       DocumentFlowMemberService, because the caller is a platform admin acting from outside the
 *       organization, not a member of it.</li>
 * </ul>
 */
@Service
public class AdminMemberService {

    private static final Set<MembershipRole> ASSIGNABLE_ROLES = Set.of(MembershipRole.values());

    private final DocumentFlowMembershipRepository membershipRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    private static final String ENTITY_TYPE = "DocumentFlowMembership";

    public AdminMemberService(DocumentFlowMembershipRepository membershipRepository,
                               CompanyRepository companyRepository,
                               UserRepository userRepository,
                               AuditLogService auditLogService) {
        this.membershipRepository = membershipRepository;
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<DocumentFlowMembership> list(Long organizationId) {
        requireOrganizationExists(organizationId);
        return membershipRepository.findByOrganizationIdAndStatusNot(organizationId, MembershipStatus.REMOVED);
    }

    @Transactional
    public DocumentFlowMembership create(Long actorUserId, Long organizationId, String email, String roleRaw) {
        requireOrganizationExists(organizationId);
        MembershipRole role = parseRole(roleRaw);

        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedEmail.isEmpty()) {
            throw new BadRequestException("Укажите email сотрудника");
        }
        User target = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseThrow(() -> new NotFoundException(
                "Пользователь с указанным email не найден", "MEMBER_NOT_FOUND"));

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

        audit(actorUserId, membership, isNew ? "MEMBER_ACCESS_GRANTED" : "MEMBER_ROLE_CHANGED",
                previousRole != null ? previousRole.name() : null, role.name(),
                isNew ? "Доступ предоставлен администратором: " + normalizedEmail : "Изменено администратором");
        return membership;
    }

    @Transactional
    public DocumentFlowMembership updateRole(Long actorUserId, Long organizationId, Long memberId, String roleRaw) {
        requireOrganizationExists(organizationId);
        MembershipRole role = parseRole(roleRaw);
        DocumentFlowMembership membership = getInOrganizationOrThrow(organizationId, memberId);

        if (membership.getRoleCode() == MembershipRole.OWNER && role != MembershipRole.OWNER
                && membership.getStatus() == MembershipStatus.ACTIVE
                && isLastActiveOwner(organizationId, memberId)) {
            throw new BadRequestException(
                    "Нельзя понизить в роли последнего активного владельца организации - сначала назначьте другого владельца",
                    "LAST_OWNER_CANNOT_BE_REMOVED");
        }

        MembershipRole previousRole = membership.getRoleCode();
        membership.setRoleCode(role);
        membershipRepository.save(membership);
        if (previousRole != role) {
            audit(actorUserId, membership, "MEMBER_ROLE_CHANGED",
                    previousRole != null ? previousRole.name() : null, role.name(), "Изменено администратором");
        }
        return membership;
    }

    @Transactional
    public DocumentFlowMembership activate(Long actorUserId, Long organizationId, Long memberId) {
        requireOrganizationExists(organizationId);
        DocumentFlowMembership membership = getInOrganizationOrThrow(organizationId, memberId);
        membership.setStatus(MembershipStatus.ACTIVE);
        if (membership.getJoinedAt() == null) {
            membership.setJoinedAt(LocalDateTime.now());
        }
        membershipRepository.save(membership);
        audit(actorUserId, membership, "MEMBER_ACTIVATED", null, null, "Активировано администратором");
        return membership;
    }

    @Transactional
    public DocumentFlowMembership deactivate(Long actorUserId, Long organizationId, Long memberId) {
        requireOrganizationExists(organizationId);
        DocumentFlowMembership membership = getInOrganizationOrThrow(organizationId, memberId);

        if (membership.getRoleCode() == MembershipRole.OWNER && membership.getStatus() == MembershipStatus.ACTIVE
                && isLastActiveOwner(organizationId, memberId)) {
            throw new BadRequestException(
                    "Нельзя деактивировать последнего активного владельца организации - сначала назначьте другого владельца",
                    "LAST_OWNER_CANNOT_BE_REMOVED");
        }

        membership.setStatus(MembershipStatus.SUSPENDED);
        membershipRepository.save(membership);
        audit(actorUserId, membership, "MEMBER_DEACTIVATED", null, null, "Деактивировано администратором");
        return membership;
    }

    /** True if {@code memberId} is currently the organization's only ACTIVE OWNER (i.e. removing
     *  its OWNER-ness would leave the organization with zero active owners). */
    private boolean isLastActiveOwner(Long organizationId, Long memberId) {
        long activeOwnerCount = membershipRepository.countByOrganizationIdAndStatusAndRoleCode(
                organizationId, MembershipStatus.ACTIVE, MembershipRole.OWNER);
        // Exactly one active OWNER and it is this member - any other active OWNER makes this safe.
        return activeOwnerCount <= 1;
    }

    /** The IDOR fix (task item 18): a memberId that resolves to a real row, but in a DIFFERENT
     *  organization than the one named in the path, must 404 exactly like a memberId that doesn't
     *  exist at all - never leak "this id exists, just not in this org" via a 403, and never act
     *  on it. */
    private DocumentFlowMembership getInOrganizationOrThrow(Long organizationId, Long memberId) {
        DocumentFlowMembership membership = membershipRepository.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден", "MEMBER_NOT_FOUND"));
        if (!membership.getOrganizationId().equals(organizationId)) {
            throw new NotFoundException("Сотрудник не найден", "MEMBER_NOT_FOUND");
        }
        return membership;
    }

    private void requireOrganizationExists(Long organizationId) {
        if (!companyRepository.existsById(organizationId)) {
            throw new NotFoundException("Организация не найдена", "ORGANIZATION_NOT_FOUND");
        }
    }

    private static MembershipRole parseRole(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Укажите role", "MEMBER_ROLE_INVALID");
        }
        try {
            MembershipRole role = MembershipRole.valueOf(raw.trim().toUpperCase());
            if (!ASSIGNABLE_ROLES.contains(role)) {
                throw new BadRequestException("Недопустимая роль: " + raw, "MEMBER_ROLE_INVALID");
            }
            return role;
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимая роль: " + raw, "MEMBER_ROLE_INVALID");
        }
    }

    private void audit(Long actorUserId, DocumentFlowMembership membership, String actionType,
                        String oldValue, String newValue, String comment) {
        User actor = userRepository.findById(actorUserId).orElse(null);
        auditLogService.log(ENTITY_TYPE, membership.getId(), null, actor, actionType, oldValue, newValue, comment);
    }
}
