package kz.ecoprogress.documentflow.api.dto;

import kz.ecoprogress.documentflow.api.AccessRequestStatus;
import kz.ecoprogress.documentflow.api.DocumentFlowAccessRequest;

import java.time.LocalDateTime;

public record AccessRequestDto(
        Long id,
        Long organizationId,
        String contactName,
        String phone,
        String email,
        String planCode,
        Integer membersCount,
        String comment,
        AccessRequestStatus status,
        LocalDateTime createdAt
) {
    public static AccessRequestDto from(DocumentFlowAccessRequest entity) {
        return new AccessRequestDto(entity.getId(), entity.getOrganizationId(), entity.getContactName(),
                entity.getPhone(), entity.getEmail(), entity.getPlanCode(), entity.getMembersCount(),
                entity.getComment(), entity.getStatus(), entity.getCreatedAt());
    }
}
