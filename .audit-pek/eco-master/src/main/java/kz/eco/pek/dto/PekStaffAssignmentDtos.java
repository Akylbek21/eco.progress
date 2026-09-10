package kz.eco.pek.dto;

import java.time.LocalDateTime;

public final class PekStaffAssignmentDtos {

    private PekStaffAssignmentDtos() {
    }

    public record PekStaffAssignmentDto(
            Long id,
            Long companyId,
            Long userId,
            String userFullName,
            String userEmail,
            String tier,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Long version
    ) {
    }

    /** email must belong to a staff account (User.role.isStaffAccount()) - assigning a CLIENT-role
     *  account is rejected (see PekStaffAssignmentService#assign): this module never creates or
     *  represents a client company's own employees. */
    public record AssignPekStaffRequest(
            String email,
            String tier
    ) {
    }

    public record UpdatePekStaffAssignmentRequest(
            String tier,
            String status
    ) {
    }
}
