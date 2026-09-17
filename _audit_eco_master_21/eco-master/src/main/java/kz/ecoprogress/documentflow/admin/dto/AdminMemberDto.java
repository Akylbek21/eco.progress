package kz.ecoprogress.documentflow.admin.dto;

import kz.eco.user.User;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;

public record AdminMemberDto(Long id, Long organizationId, Long userId, String fullName, String email, String role, String status) {
    public static AdminMemberDto from(DocumentFlowMembership membership, User user) {
        return new AdminMemberDto(
                membership.getId(),
                membership.getOrganizationId(),
                membership.getUserId(),
                user != null ? user.getName() : null,
                user != null ? user.getEmail() : null,
                membership.getRoleCode() != null ? membership.getRoleCode().name() : null,
                membership.getStatus().name());
    }
}
