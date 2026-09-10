package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * GET /api/pek/lookups/assignees and GET /api/pek/lookups/objects/{objectId}/permits - both
 * previously entirely absent (404), same critical gap as the dashboard.
 */
@Service
public class PekLookupService {

    /**
     * The frontend's "roles" query param uses PEK-domain assignment roles (who may be a program's
     * responsible/reviewer/approver), not this codebase's authentication kz.eco.user.UserRole enum
     * - there is no 1:1 mapping, so this table defines one. An unrecognized role token is silently
     * skipped (not a 400): the frontend may reasonably ask for a broader role vocabulary than the
     * backend currently models, and that should degrade to "no matches for that token" rather than
     * fail the whole lookup.
     */
    private static final Map<String, Set<UserRole>> ROLE_MAP = Map.of(
            "PEK_RESPONSIBLE", Set.of(UserRole.ECOLOGIST, UserRole.HEAD, UserRole.MANAGER, UserRole.LABORATORY),
            "PEK_REVIEWER", Set.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD),
            "PEK_APPROVER", Set.of(UserRole.ADMIN, UserRole.DIRECTOR)
    );

    private final UserRepository userRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final PekStaffAssignmentRepository membershipRepository;
    private final PekEnvironmentalPermitRepository permitRepository;

    public PekLookupService(UserRepository userRepository, CompanyObjectRepository companyObjectRepository,
                             PekStaffAssignmentRepository membershipRepository,
                             PekEnvironmentalPermitRepository permitRepository) {
        this.userRepository = userRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.membershipRepository = membershipRepository;
        this.permitRepository = permitRepository;
    }

    /** @param companyIds the caller's accessible companies (null = global access, i.e.
     *  unrestricted). A non-global caller only ever sees users who themselves hold an ACTIVE
     *  {@link PekStaffAssignment} in one of those same companies - matching a role token alone
     *  (the old behavior) let any PEK_VIEW-eligible caller enumerate every ECOLOGIST/HEAD/etc in
     *  the whole system regardless of company, which is exactly the kind of cross-tenant leak
     *  Iteration 1 closes. */
    @Transactional(readOnly = true)
    public List<PekApiDtos.AssigneeResponse> assignees(String rolesParam, java.util.Collection<Long> companyIds) {
        if (rolesParam == null || rolesParam.isBlank()) {
            throw new BadRequestException("Укажите roles");
        }
        Set<Long> allowedUserIds = null;
        if (companyIds != null) {
            allowedUserIds = membershipRepository.findByCompanyIdInAndStatus(List.copyOf(companyIds), PekMembershipStatus.ACTIVE)
                    .stream().map(PekStaffAssignment::getUserId).collect(java.util.stream.Collectors.toSet());
            if (allowedUserIds.isEmpty()) {
                return List.of();
            }
        }
        List<PekApiDtos.AssigneeResponse> result = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        for (String token : rolesParam.split(",")) {
            String roleKey = token.trim().toUpperCase(Locale.ROOT);
            if (roleKey.isEmpty()) {
                continue;
            }
            Set<UserRole> mapped = ROLE_MAP.get(roleKey);
            if (mapped == null) {
                continue;
            }
            for (User u : userRepository.findByRoleInAndStatusNot(List.copyOf(mapped), UserStatus.deleted)) {
                if (u.getStatus() != UserStatus.active || !seen.add(u.getId())) {
                    continue;
                }
                if (allowedUserIds != null && !allowedUserIds.contains(u.getId())) {
                    continue;
                }
                result.add(new PekApiDtos.AssigneeResponse(u.getId(), u.getName(), describe(u), "ACTIVE", roleKey));
            }
        }
        return result;
    }

    private static String describe(User u) {
        if (u.getPosition() != null && !u.getPosition().isBlank()) {
            return u.getPosition();
        }
        return switch (u.getRole()) {
            case ECOLOGIST -> "Эколог";
            case LABORATORY -> "Лаборатория";
            case HEAD -> "Руководитель";
            case DIRECTOR -> "Директор";
            case ADMIN -> "Администратор";
            case MANAGER -> "Менеджер";
            default -> u.getRole().name();
        };
    }

    /** Real permit rows, scoped to the object (Iteration 2 of the PEK module overhaul - this used
     *  to be a hardcoded empty list because no Permit entity existed anywhere in the codebase). */
    @Transactional(readOnly = true)
    public List<PekApiDtos.PermitResponse> permitsForObject(Long objectId) {
        if (companyObjectRepository.findById(objectId).isEmpty()) {
            throw new NotFoundException("Объект не найден: " + objectId);
        }
        return permitRepository.findByObjectIdOrderByValidToDesc(objectId).stream()
                .map(p -> new PekApiDtos.PermitResponse(
                        p.getId(), p.getCompanyId(), p.getObjectId(), p.getType(), p.getNumber(),
                        p.getIssuedAt() == null ? null : p.getIssuedAt().toString(),
                        p.getValidFrom() == null ? null : p.getValidFrom().toString(),
                        p.getValidTo() == null ? null : p.getValidTo().toString(),
                        p.getAuthority(), p.getStatus().name(), p.isActiveOn(java.time.LocalDate.now()),
                        p.getFileId(), p.getNote(), p.getPekProgramId(), p.getVersion(), java.util.Map.of()))
                .toList();
    }
}
