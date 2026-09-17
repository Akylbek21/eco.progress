package kz.eco.user.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.company.CompanyPermissionMatrix;
import kz.eco.pek.PekPermissionMatrix;
import kz.eco.user.User;
import kz.eco.user.UserRole;

import java.util.Map;
import java.util.Set;

public record UserResponse(
        Long id,
        String role,
        String type,
        String email,
        String name,
        String phone,
        String city,
        String companyName,
        String bin,
        String organizationType,
        String legalAddress,
        String position,
        String status,
        String iin,
        String lastLoginAt,
        String createdAt,
        /** COMPANY_* permission matrix (module: Companies tenant isolation) - a convenience mirror
         *  of the role sets already enforced via @PreAuthorize, see CompanyPermissionMatrix. */
        Map<String, Boolean> companyPermissions,
        /** PEK_* permissions for this user's role, so the UI can enable exactly the actions the
         *  backend will actually allow. Advisory only - every PEK endpoint still enforces its own
         *  @PreAuthorize plus PekAccessService company-scoping, see PekPermissionMatrix. */
        Set<String> permissions
) {
    public static UserResponse from(User user) {
        if (user == null) return null;
        return new UserResponse(
                user.getId(),
                user.getRole().name(),
                user.getType().name(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getCity(),
                user.getCompanyName(),
                user.getBin(),
                user.getOrganizationType(),
                user.getLegalAddress(),
                user.getPosition(),
                user.getStatus().name(),
                user.getIin(),
                RuDateFormatter.formatDateTime(user.getLastLoginAt()),
                RuDateFormatter.formatDateTime(user.getCreatedAt()),
                CompanyPermissionMatrix.forRole(user.getRole()),
                permissionsFor(user.getRole())
        );
    }

    /** PEK_* plus NORMATIVE_* - both derived from the @PreAuthorize expressions themselves. */
    private static Set<String> permissionsFor(UserRole role) {
        Set<String> all = new java.util.LinkedHashSet<>(PekPermissionMatrix.forRole(role));
        all.addAll(kz.eco.normative.NormativePermissionMatrix.forRole(role));
        return java.util.Collections.unmodifiableSet(all);
    }
}
