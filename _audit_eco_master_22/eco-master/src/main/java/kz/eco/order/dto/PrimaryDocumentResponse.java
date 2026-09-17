package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.OrderPrimaryDocument;
import kz.eco.order.PrimaryDocumentStatus;

public record PrimaryDocumentResponse(
        Long id,
        String documentGroup,
        String name,
        boolean required,
        PrimaryDocumentStatus status,
        String fileName,
        String fileUrl,
        String clientComment,
        String staffComment,
        String requestedAt,
        String uploadedAt,
        String reviewedAt,
        String createdAt,
        String updatedAt
) {
    public static PrimaryDocumentResponse from(OrderPrimaryDocument d) {
        return new PrimaryDocumentResponse(
                d.getId(),
                d.getDocumentGroup(),
                d.getName(),
                d.isRequired(),
                d.getStatus(),
                d.getFileName(),
                d.getFileUrl(),
                d.getClientComment(),
                d.getStaffComment(),
                RuDateFormatter.formatDateTime(d.getRequestedAt()),
                RuDateFormatter.formatDateTime(d.getUploadedAt()),
                RuDateFormatter.formatDateTime(d.getReviewedAt()),
                RuDateFormatter.formatDateTime(d.getCreatedAt()),
                RuDateFormatter.formatDateTime(d.getUpdatedAt())
        );
    }
}
