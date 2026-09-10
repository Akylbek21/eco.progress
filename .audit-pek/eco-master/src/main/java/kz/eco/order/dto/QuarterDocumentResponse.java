package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.DocumentVisibility;
import kz.eco.order.QuarterDocument;
import kz.eco.order.QuarterDocumentType;

public record QuarterDocumentResponse(
        Long id,
        String name,
        String fileName,
        String fileUrl,
        String mimeType,
        Long fileSize,
        QuarterDocumentType documentType,
        DocumentVisibility visibility,
        String uploadedByRole,
        String uploadedByName,
        String createdAt
) {
    public static QuarterDocumentResponse from(QuarterDocument d) {
        return new QuarterDocumentResponse(
                d.getId(),
                d.getName(),
                d.getFileName(),
                d.getFileUrl(),
                d.getMimeType(),
                d.getFileSize(),
                d.getDocumentType(),
                d.getVisibility(),
                d.getUploadedByRole(),
                d.getUploadedByName(),
                RuDateFormatter.formatDateTime(d.getCreatedAt())
        );
    }
}
