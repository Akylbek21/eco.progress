package kz.eco.company;

import kz.eco.common.exception.BadRequestException;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tenant-scoping for the Companies module - which companyId(s) a given user may see/act on. Mirrors
 * {@link kz.eco.pek.PekAccessService} exactly (same gap, same fix shape), but is NOT a reuse of PEK's
 * membership table: Companies and PEK are different bounded contexts with independent access grants
 * (a user may see a company's protocols/objects without being on its PEK team, and vice versa).
 */
@Service
public class CompanyAccessService {

    private final CompanyMembershipRepository membershipRepository;
    private final UserRepository userRepository;

    /** Roles with unconditional access to every company - consistent with the existing project
     *  convention of never scoping ADMIN/DIRECTOR to a single company (see PekAccessService). */
    private static final Set<UserRole> GLOBAL_ACCESS_ROLES = EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR);

    public CompanyAccessService(CompanyMembershipRepository membershipRepository, UserRepository userRepository) {
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
    }

    public boolean hasGlobalAccess(UserRole role) {
        return role != null && GLOBAL_ACCESS_ROLES.contains(role);
    }

    /** The set of companyIds the given user has ACTIVE membership in. Meaningless (and never
     *  called) for a global-access role - callers must check {@link #hasGlobalAccess(UserRole)}
     *  first; an empty set here means "no company access" for a non-global user, not "all". */
    public Set<Long> resolveAccessibleCompanyIds(Long userId, UserRole role) {
        if (hasGlobalAccess(role)) {
            throw new IllegalStateException(
                    "resolveAccessibleCompanyIds is not meaningful for a global-access role - check hasGlobalAccess first");
        }
        return membershipRepository.findByUserIdAndStatus(userId, CompanyMembershipStatus.ACTIVE).stream()
                .map(CompanyMembership::getCompanyId)
                .collect(Collectors.toSet());
    }

    /** Throws 403 unless the user has global access or an ACTIVE membership in companyId, and the
     *  user account itself is active. */
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
                companyId, userId, CompanyMembershipStatus.ACTIVE);
        if (!member) {
            throw new AccessDeniedException("Нет доступа к данным этой компании");
        }
    }
}
