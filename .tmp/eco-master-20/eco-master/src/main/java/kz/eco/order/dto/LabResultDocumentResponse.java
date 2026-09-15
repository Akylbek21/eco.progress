package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.LabResultDocumentStatus;
import kz.eco.order.LaboratoryResultDocument;

public record LabResultDocumentResponse(
        Long id,
        String name,
        String section,
        Integer quarter,
        String fileName,
        String fileUrl,
        LabResultDocumentStatus status,
        String staffComment,
        String uploadedAt,
        String approvedAt,
        String createdAt,
        String updatedAt
) {
    public static LabResultDocumentResponse from(LaboratoryResultDocument d) {
        return new LabResultDocumentResponse(
                d.getId(),
                d.getName(),
                d.getSection(),
                d.getQuarter(),
                d.getFileName(),
                d.getFileUrl(),
                d.getStatus(),
                d.getStaffComment(),
                RuDateFormatter.formatDateTime(d.getUploadedAt()),
                RuDateFormatter.formatDateTime(d.getApprovedAt()),
                RuDateFormatter.formatDateTime(d.getCreatedAt()),
                RuDateFormatter.formatDateTime(d.getUpdatedAt())
        );
    }
}
