package kz.eco.company;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.dto.CompanyDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * CRUD for {@link CompanyMembership} rows - who besides an ADMIN/DIRECTOR (global access, see
 * {@link CompanyAccessService#hasGlobalAccess}) may see/act on a given company. Every method
 * re-checks {@link CompanyAccessService#requireCompanyAccess} itself rather than trusting the
 * controller's {@code @PreAuthorize} alone, same posture as {@link CompanyService}.
 */
@Service
public class CompanyMembershipService {

    private final CompanyMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final CompanyAccessService accessService;
    private final CompanyAuditService auditService;

    public CompanyMembershipService(CompanyMembershipRepository membershipRepository,
                                     UserRepository userRepository,
                                     CompanyAccessService accessService,
                                     CompanyAuditService auditService) {
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.accessService = accessService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<CompanyDtos.CompanyMembershipDto> list(Long companyId, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        return membershipRepository.findByCompanyIdOrderByCreatedAtAsc(companyId).stream()
                .map(this::toDto)
                .toList();
    }

    /** Upsert: the DB unique constraint is on (company_id, user_id) regardless of status, so a
     *  previously-deactivated member must be reactivated here, not duplicated. */
    @Transactional
    public CompanyDtos.CompanyMembershipDto add(Long companyId, CompanyDtos.AddCompanyMembershipRequest request,
                                                 Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);

        String normalizedEmail = request.email() == null ? "" : request.email().trim().toLowerCase();
        if (normalizedEmail.isEmpty()) {
            throw new BadRequestException("Укажите email сотрудника");
        }
        User target = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new NotFoundException(
                        "Пользователь с указанным email не найден", "MEMBER_NOT_FOUND"));
        UserRole roleCode = parseRole(request.roleCode());

        CompanyMembership membership = membershipRepository.findByCompanyIdAndUserId(companyId, target.getId())
                .orElseGet(() -> {
                    CompanyMembership created = new CompanyMembership();
                    created.setCompanyId(companyId);
                    created.setUserId(target.getId());
                    return created;
                });
        membership.setRoleCode(roleCode);
        membership.setStatus(CompanyMembershipStatus.ACTIVE);
        membership.setUpdatedAt(LocalDateTime.now());
        membershipRepository.save(membership);

        auditService.log("COMPANY_MEMBERSHIP", membership.getId(), CompanyAuditAction.MEMBER_ADDED,
                actorUserId, List.of());
        return toDto(membership);
    }

    @Transactional
    public CompanyDtos.CompanyMembershipDto updateRoleOrStatus(Long companyId, Long membershipId,
                                                                CompanyDtos.UpdateCompanyMembershipRequest request,
                                                                Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        CompanyMembership membership = getInCompany(companyId, membershipId);
        requireCurrentVersion(membership, request.version());

        if (request.roleCode() != null && !request.roleCode().isBlank()) {
            membership.setRoleCode(parseRole(request.roleCode()));
            auditService.log("COMPANY_MEMBERSHIP", membership.getId(), CompanyAuditAction.MEMBER_ROLE_CHANGED,
                    actorUserId, List.of());
        }
        if (request.status() != null && !request.status().isBlank()) {
            membership.setStatus(parseStatus(request.status()));
            auditService.log("COMPANY_MEMBERSHIP", membership.getId(), CompanyAuditAction.MEMBER_STATUS_CHANGED,
                    actorUserId, List.of());
        }
        membership.setUpdatedAt(LocalDateTime.now());
        membershipRepository.saveAndFlush(membership);
        return toDto(membership);
    }

    /** Soft: deactivates rather than deletes the row, consistent with the module's archive-not-
     *  delete convention (see CompanyService#delete). */
    @Transactional
    public void remove(Long companyId, Long membershipId, Long version, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        CompanyMembership membership = getInCompany(companyId, membershipId);
        requireCurrentVersion(membership, version);
        membership.setStatus(CompanyMembershipStatus.INACTIVE);
        membership.setUpdatedAt(LocalDateTime.now());
        membershipRepository.save(membership);
        auditService.log("COMPANY_MEMBERSHIP", membership.getId(), CompanyAuditAction.MEMBER_REMOVED,
                actorUserId, List.of());
    }

    /** P0 module fix item 2/3: version is mandatory for membership update/delete - a stale (or
     *  missing) version is rejected with 409 VERSION_CONFLICT rather than silently overwriting a
     *  concurrent change. */
    private void requireCurrentVersion(CompanyMembership membership, Long version) {
        if (version == null) {
            throw new BadRequestException("Укажите version", "VERSION_REQUIRED");
        }
        if (!version.equals(membership.getVersion())) {
            throw new ConflictException("Запись была изменена другим пользователем", "VERSION_CONFLICT");
        }
    }

    private CompanyMembership getInCompany(Long companyId, Long membershipId) {
        return membershipRepository.findByIdAndCompanyId(membershipId, companyId)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден", "MEMBER_NOT_FOUND"));
    }

    private UserRole parseRole(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException("Укажите roleCode");
        }
        try {
            return UserRole.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимая роль: " + raw);
        }
    }

    private CompanyMembershipStatus parseStatus(String raw) {
        try {
            return CompanyMembershipStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимый статус. Допустимо: ACTIVE, INACTIVE");
        }
    }

    private CompanyDtos.CompanyMembershipDto toDto(CompanyMembership membership) {
        User user = userRepository.findById(membership.getUserId()).orElse(null);
        return new CompanyDtos.CompanyMembershipDto(
                membership.getId(),
                membership.getCompanyId(),
                membership.getUserId(),
                user != null ? user.getName() : null,
                user != null ? user.getEmail() : null,
                membership.getRoleCode() != null ? membership.getRoleCode().name() : null,
                membership.getStatus().name(),
                membership.getCreatedAt(),
                membership.getUpdatedAt(),
                membership.getVersion()
        );
    }
}
