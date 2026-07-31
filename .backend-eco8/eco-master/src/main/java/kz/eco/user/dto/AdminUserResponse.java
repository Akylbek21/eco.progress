package kz.eco.user.dto;

import kz.eco.user.User;

public record AdminUserResponse(
        Long id,
        String email,
        String name,
        String phone,
        String city,
        String legalAddress,
        String role,
        String position,
        String status,
        String type,
        String companyName,
        String bin,
        String organizationType,
        String lastLoginAt,
        String createdAt,
        String updatedAt
) {
    public static AdminUserResponse from(User user) {
        if (user == null) {
            return null;
        }
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getPhone(),
                user.getCity(),
                user.getLegalAddress(),
                user.getRole().name(),
                user.getPosition(),
                user.getStatus().name(),
                user.getType() != null ? user.getType().name() : null,
                user.getCompanyName(),
                user.getBin(),
                user.getOrganizationType(),
                formatIso(user.getLastLoginAt()),
                formatIso(user.getCreatedAt()),
                formatIso(user.getUpdatedAt())
        );
    }

    private static String formatIso(java.time.LocalDateTime value) {
        return value != null ? value.toString() : null;
    }
}
