package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Centralizes the company/object ownership checks that used to be duplicated ad hoc inline in
 * {@link PekProgramService} and {@link PekReportService} (each independently re-implementing "does
 * this objectId really belong to this companyId" / "does this program really belong to this
 * company+object" - the kind of scattered, checked-in-some-places-not-others logic that is easy to
 * forget on a new endpoint). Every method here is a straight extraction of an existing check, not a
 * new policy - see the class-level note below on what this deliberately does NOT change.
 *
 * <p><b>Company scope/permissions</b>: backed by {@link PekStaffAssignment} - an explicit "our
 * staff assigned to this client company" table with a real {@link PekStaffTier} permission tier,
 * never the generic {@code UserRole} enum. This module used to read {@link PekCompanyMembership}
 * for this (module fix item 1: that table conflated "which account may act on this company" with
 * a raw copy of the account's global role, and nothing stopped assigning a CLIENT-role account as
 * if it were PEK staff of that company) - {@code PekCompanyMembership} is left in place, unused by
 * any access-control path here, purely so historical rows/its own CRUD API keep working.
 *
 * <p><b>What the narrower id-consistency checks below are for</b>: a caller supplying a
 * companyId/objectId/programId combination that doesn't actually match the real resource
 * (parameter substitution) - e.g. claiming companyId=A in a create-report request while objectId
 * or programId actually belongs to company B. These complement, never replace, the company-scope
 * gate above.
 */
@Service
public class PekAccessService {

    private final CompanyObjectRepository companyObjectRepository;
    private final PekStaffAssignmentRepository membershipRepository;
    private final UserRepository userRepository;

    /** Roles with unconditional access to every company's PEK data - consistent with the existing
     *  project convention of never scoping ADMIN/DIRECTOR to a single company (e.g.
     *  ProtocolPermissionService.SUPERVISOR_ROLES, /api/admin/** role-only gating). */
    private static final Set<UserRole> GLOBAL_ACCESS_ROLES = EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR);

    /** Module fix: membership.roleCode used to be decorative - requireCompanyAccess only checked
     *  that an ACTIVE membership row existed at all, never what role it carried, so a LABORATORY
     *  membership granted exactly the same company access as a HEAD one. These are the real
     *  company-scoped permission tiers, checked via {@link #requireCompanyEditPermission} /
     *  {@link #requireCompanyReviewPermission} in addition to (never instead of) the existing
     *  global-role @PreAuthorize gates on the controller - defense in depth, not a replacement.
     *  PEK_VIEWER (any other active-membership role not listed below) stays view-only. */

    public PekAccessService(CompanyObjectRepository companyObjectRepository,
                             PekStaffAssignmentRepository membershipRepository,
                             UserRepository userRepository) {
        this.companyObjectRepository = companyObjectRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
    }

    // ---------------------------------------------------------------------------------------
    // Real tenant-scoping checks (Iteration 1 of the PEK module overhaul). Everything above this
    // point in the file is the older, narrower id-consistency guard (parameter substitution only,
    // see the class javadoc); everything below is the new membership-backed "which companies can
    // this user actually see" gate that the class javadoc used to say did not exist.
    // ---------------------------------------------------------------------------------------

    /** ADMIN/DIRECTOR bypass membership checks entirely and see every company's PEK data. */
    public boolean hasGlobalAccess(UserRole role) {
        return role != null && GLOBAL_ACCESS_ROLES.contains(role);
    }

    /** The set of companyIds the given user has ACTIVE PEK membership in. Meaningless (and never
     *  called) for a global-access role - callers must check {@link #hasGlobalAccess(UserRole)}
     *  first; an empty set here means "no company access" for a non-global user, not "all". */
    public Set<Long> resolveAccessibleCompanyIds(Long userId, UserRole role) {
        if (hasGlobalAccess(role)) {
            throw new IllegalStateException(
                    "resolveAccessibleCompanyIds is not meaningful for a global-access role - check hasGlobalAccess first");
        }
        return membershipRepository.findByUserIdAndStatus(userId, PekMembershipStatus.ACTIVE).stream()
                .map(PekStaffAssignment::getCompanyId)
                .collect(java.util.stream.Collectors.toSet());
    }

    /** Throws (403) unless the user has global access or an ACTIVE membership in companyId, and
     *  the user account itself is active. This is the real per-user visibility gate that used to
     *  be entirely absent - see the class javadoc's older methods for the narrower id-consistency
     *  checks this complements, not replaces. */
    public void requireCompanyAccess(Long userId, UserRole role, Long companyId) {
        if (companyId == null) {
            throw new BadRequestException("Укажите companyId");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getStatus() != UserStatus.active) {
            throw new AccessDeniedException("Учётная запись пользователя недоступна");
        }
        if (hasGlobalAccess(role)) {
            return;
        }
        boolean member = membershipRepository.existsByCompanyIdAndUserIdAndStatus(
                companyId, userId, PekMembershipStatus.ACTIVE);
        if (!member) {
            throw new AccessDeniedException("Нет доступа к данным ПЭК этой компании");
        }
    }

    /** Resolves the object's real companyId (never a caller-supplied one) and delegates to
     *  {@link #requireCompanyAccess(Long, UserRole, Long)}. */
    public void requireObjectAccess(Long userId, UserRole role, Long objectId) {
        if (objectId == null) {
            throw new BadRequestException("Укажите objectId");
        }
        CompanyObject object = companyObjectRepository.findById(objectId)
                .orElseThrow(() -> new NotFoundException("Объект не найден: " + objectId));
        requireCompanyAccess(userId, role, object.getCompanyId());
    }

    public void requireProgramAccess(Long userId, UserRole role, PekProgram program) {
        requireCompanyAccess(userId, role, program.getCompanyId());
    }

    public void requireReportAccess(Long userId, UserRole role, PekReport report) {
        requireCompanyAccess(userId, role, report.getCompanyId());
    }

    /** Resolves "the one company this user's request implicitly means" the same way
     *  {@code OrganizationResolver#resolve(userId, null)} used to for document-flow - used by
     *  {@link PekSettingsService}, which (unlike every other PEK endpoint) has no explicit
     *  companyId in its request. A global-access user with zero membership rows has no implicit
     *  company and must be told to specify one explicitly - Iteration 1 does not fabricate an
     *  "ADMIN's default company" concept that doesn't exist anywhere else in this codebase. */
    public Long resolveSingleCompanyId(Long userId, UserRole role) {
        List<PekStaffAssignment> memberships =
                membershipRepository.findByUserIdAndStatus(userId, PekMembershipStatus.ACTIVE);
        if (memberships.size() == 1) {
            return memberships.get(0).getCompanyId();
        }
        if (memberships.isEmpty()) {
            if (hasGlobalAccess(role)) {
                throw new BadRequestException("Укажите companyId явно", "PEK_COMPANY_ID_REQUIRED");
            }
            throw new AccessDeniedException("Пользователь не состоит ни в одной компании ПЭК");
        }
        throw new BadRequestException("Пользователь состоит в нескольких компаниях - укажите companyId явно",
                "PEK_MULTIPLE_COMPANIES");
    }

    /** objectId must be a real, non-archived CompanyObject belonging to companyId - PEK never
     *  treats companyId as a stand-in objectId (spec: no virtual objects derived from companyId).
     *  Extracted from the identical inline logic previously duplicated in
     *  PekProgramService#create and PekReportService#validateObject. */
    public CompanyObject requireObjectBelongsToCompany(Long companyId, Long objectId) {
        if (companyId == null) {
            throw new BadRequestException("Укажите companyId");
        }
        if (objectId == null) {
            throw new BadRequestException("Укажите objectId");
        }
        CompanyObject object = companyObjectRepository.findByIdAndCompanyId(objectId, companyId)
                .orElseThrow(() -> new BadRequestException(
                        "Объект не найден или не принадлежит выбранной компании", "OBJECT_COMPANY_MISMATCH"));
        if (object.getArchivedAt() != null) {
            throw new BadRequestException("Объект архивирован", "OBJECT_ARCHIVED");
        }
        return object;
    }

    /** Parameter-substitution guard: a caller-claimed companyId (request body/query param) must
     *  match the actual resource's companyId. Does not implement per-user company visibility (see
     *  class javadoc) - role-based access via {@link PekSecurityExpressions} remains the sole
     *  visibility gate; this only rejects an internally-inconsistent request. */
    public void requireCompanyMatches(Long resourceCompanyId, Long claimedCompanyId) {
        if (claimedCompanyId != null && !claimedCompanyId.equals(resourceCompanyId)) {
            throw new BadRequestException(
                    "companyId не соответствует запрашиваемому ресурсу ПЭК", "PEK_COMPANY_MISMATCH");
        }
    }

    /** A PekProgram referenced by id in a report-creation request must actually belong to the
     *  company+object the request claims - extracted from the identical inline check previously
     *  only present in PekReportService#create. */
    public void requireProgramBelongsTo(PekProgram program, Long companyId, Long objectId) {
        if (!program.getCompanyId().equals(companyId) || !program.getObjectId().equals(objectId)) {
            throw new BadRequestException("Программа ПЭК относится к другому объекту", "PEK_PROGRAM_SCOPE_MISMATCH");
        }
    }

    /** Same shape of check for a PekReport - used wherever a report is looked up alongside a
     *  caller-supplied companyId that must agree with it. */
    public void requireReportBelongsTo(PekReport report, Long companyId) {
        requireCompanyMatches(report.getCompanyId(), companyId);
    }

    /** Module fix: company-scoped edit permission, driven by the actual assignment's
     *  {@link PekStaffTier} (never trusted from the frontend - always re-resolved from the
     *  persisted row) rather than "any active assignment at all". Global-access roles
     *  (ADMIN/DIRECTOR) bypass, same as every other check in this class. */
    public void requireCompanyEditPermission(Long userId, UserRole role, Long companyId) {
        requireCompanyTier(userId, role, companyId, PekStaffTier.EDITOR);
    }

    /** Company-scoped review permission (approve/return/archive) - REVIEWER tier. */
    public void requireCompanyReviewPermission(Long userId, UserRole role, Long companyId) {
        requireCompanyTier(userId, role, companyId, PekStaffTier.REVIEWER);
    }

    private void requireCompanyTier(Long userId, UserRole role, Long companyId, PekStaffTier required) {
        if (!hasCompanyTier(userId, role, companyId, required)) {
            throw new AccessDeniedException("Недостаточно прав в рамках компании для этого действия");
        }
    }

    /** Non-throwing form of the tier check, for computing availableActions (which must reflect
     *  exactly what the enforcing check above would allow, never guess independently). */
    public boolean hasCompanyTier(Long userId, UserRole role, Long companyId, PekStaffTier required) {
        if (hasGlobalAccess(role)) {
            return true;
        }
        return membershipRepository.findByCompanyIdAndUserIdAndStatus(companyId, userId, PekMembershipStatus.ACTIVE)
                .map(m -> m.getTier().atLeast(required))
                .orElse(false);
    }

    public boolean hasCompanyEditPermission(Long userId, UserRole role, Long companyId) {
        return hasCompanyTier(userId, role, companyId, PekStaffTier.EDITOR);
    }

    public boolean hasCompanyReviewPermission(Long userId, UserRole role, Long companyId) {
        return hasCompanyTier(userId, role, companyId, PekStaffTier.REVIEWER);
    }

    public boolean canViewSettings(kz.eco.user.User user) {
        return user != null && user.getRole().isStaffAccount();
    }

    public boolean canEditSettings(kz.eco.user.User user) {
        return user != null && java.util.Set.of(kz.eco.user.UserRole.ADMIN, kz.eco.user.UserRole.DIRECTOR,
                kz.eco.user.UserRole.HEAD).contains(user.getRole());
    }
}
