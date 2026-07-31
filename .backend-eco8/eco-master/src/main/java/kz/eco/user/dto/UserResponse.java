package kz.eco.user.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.user.User;
import kz.eco.user.UserRole;

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
        String lastLoginAt,
        String createdAt
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
                RuDateFormatter.formatDateTime(user.getLastLoginAt()),
                RuDateFormatter.formatDateTime(user.getCreatedAt())
        );
    }
}
