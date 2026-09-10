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
        /** Server-authoritative route/action grants for the PEK module. */
        Set<String> permissions,
        /** COMPANY_* permission matrix (module: Companies tenant isolation) - a convenience mirror
         *  of the role sets already enforced via @PreAuthorize, see CompanyPermissionMatrix. */
        Map<String, Boolean> companyPermissions
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
                PekPermissionMatrix.forRole(user.getRole()),
                CompanyPermissionMatrix.forRole(user.getRole())
        );
    }
}
