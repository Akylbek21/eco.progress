package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekMembershipDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * CRUD for {@link PekCompanyMembership} rows - who besides an ADMIN/DIRECTOR (global access, see
 * {@link PekAccessService#hasGlobalAccess}) may see/act on a given company's PEK data. Mirrors
 * {@code kz.eco.company.CompanyMembershipService} exactly (same shape, PEK-specific table). Every
 * method re-checks {@link PekAccessService#requireCompanyAccess} itself rather than trusting the
 * controller's {@code @PreAuthorize} alone.
 */
@Service
public class PekCompanyMembershipService {

    private final PekCompanyMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final PekAccessService accessService;

    public PekCompanyMembershipService(PekCompanyMembershipRepository membershipRepository,
                                        UserRepository userRepository,
                                        PekAccessService accessService) {
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.accessService = accessService;
    }

    @Transactional(readOnly = true)
    public List<PekMembershipDtos.PekCompanyMembershipDto> list(Long companyId, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        return membershipRepository.findByCompanyIdOrderByCreatedAtAsc(companyId).stream()
                .map(this::toDto)
                .toList();
    }

    /** Upsert: the DB unique constraint is on (company_id, user_id) regardless of status, so a
     *  previously-deactivated member must be reactivated here, not duplicated. Also the mechanism
     *  by which a newly created/connected company can immediately staff itself, without a manual
     *  DB seed. */
    @Transactional
    public PekMembershipDtos.PekCompanyMembershipDto add(Long companyId, PekMembershipDtos.AddPekMembershipRequest request,
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

        PekCompanyMembership membership = membershipRepository.findByCompanyIdAndUserId(companyId, target.getId())
                .orElseGet(() -> {
                    PekCompanyMembership created = new PekCompanyMembership();
                    created.setCompanyId(companyId);
                    created.setUserId(target.getId());
                    created.setInvitedBy(actorUserId);
                    return created;
                });
        membership.setRoleCode(roleCode);
        membership.setStatus(PekMembershipStatus.ACTIVE);
        if (membership.getJoinedAt() == null) {
            membership.setJoinedAt(LocalDateTime.now());
        }
        membership.setUpdatedAt(LocalDateTime.now());
        membershipRepository.save(membership);
        return toDto(membership);
    }

    @Transactional
    public PekMembershipDtos.PekCompanyMembershipDto updateRoleOrStatus(
            Long companyId, Long membershipId, PekMembershipDtos.UpdatePekMembershipRequest request,
            Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        PekCompanyMembership membership = getInCompany(companyId, membershipId);

        if (request.roleCode() != null && !request.roleCode().isBlank()) {
            membership.setRoleCode(parseRole(request.roleCode()));
        }
        if (request.status() != null && !request.status().isBlank()) {
            membership.setStatus(parseStatus(request.status()));
        }
        membership.setUpdatedAt(LocalDateTime.now());
        membershipRepository.save(membership);
        return toDto(membership);
    }

    /** Soft: deactivates rather than deletes the row, consistent with the module's other
     *  soft-status conventions. */
    @Transactional
    public void remove(Long companyId, Long membershipId, Long actorUserId, UserRole actorRole) {
        accessService.requireCompanyAccess(actorUserId, actorRole, companyId);
        PekCompanyMembership membership = getInCompany(companyId, membershipId);
        membership.setStatus(PekMembershipStatus.REMOVED);
        membership.setUpdatedAt(LocalDateTime.now());
        membershipRepository.save(membership);
    }

    private PekCompanyMembership getInCompany(Long companyId, Long membershipId) {
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

    private PekMembershipStatus parseStatus(String raw) {
        try {
            return PekMembershipStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Недопустимый статус. Допустимо: ACTIVE, INVITED, REMOVED");
        }
    }

    private PekMembershipDtos.PekCompanyMembershipDto toDto(PekCompanyMembership membership) {
        User user = userRepository.findById(membership.getUserId()).orElse(null);
        return new PekMembershipDtos.PekCompanyMembershipDto(
                membership.getId(),
                membership.getCompanyId(),
                membership.getUserId(),
                user != null ? user.getName() : null,
                user != null ? user.getEmail() : null,
                membership.getRoleCode() != null ? membership.getRoleCode().name() : null,
                membership.getStatus().name(),
                membership.getCreatedAt(),
                membership.getUpdatedAt()
        );
    }
}
