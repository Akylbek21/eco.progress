package kz.eco.pek.dto;

import java.time.LocalDateTime;

public final class PekMembershipDtos {

    private PekMembershipDtos() {
    }

    public record PekCompanyMembershipDto(
            Long id,
            Long companyId,
            Long userId,
            String userFullName,
            String userEmail,
            String roleCode,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record AddPekMembershipRequest(
            String email,
            String roleCode
    ) {
    }

    /** Partial update - both fields optional, null means "leave unchanged". */
    public record UpdatePekMembershipRequest(
            String roleCode,
            String status
    ) {
    }
}
