package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.DocumentType;
import kz.eco.order.DocumentVisibility;
import kz.eco.order.OrderDocument;

public record DocumentResponse(
        Long id,
        String name,
        String fileName,
        String fileUrl,
        String mimeType,
        Long fileSize,
        DocumentType type,
        DocumentVisibility visibility,
        String status,
        String uploadedByRole,
        String uploadedAt,
        boolean sentToClient,
        boolean needsSignature,
        boolean needsClientResponse,
        String clientResponseStatus,
        String staffComment,
        String clientComment,
        String dueDate
) {
    public static DocumentResponse from(OrderDocument d) {
        return new DocumentResponse(
                d.getId(),
                d.getName(),
                d.getFileName(),
                d.getFileUrl(),
                d.getMimeType(),
                d.getFileSize(),
                d.getType(),
                d.getVisibility(),
                d.getStatus(),
                d.getUploadedByRole(),
                RuDateFormatter.formatDateTime(d.getUploadedAt()),
                d.isSentToClient(),
                d.isNeedsSignature(),
                d.isNeedsClientResponse(),
                d.getClientResponseStatus(),
                d.getStaffComment(),
                d.getClientComment(),
                d.getDueDate() != null ? d.getDueDate().toString() : null
        );
    }

    public boolean isAgreementTab() {
        return sentToClient || needsSignature || needsClientResponse;
    }
}
