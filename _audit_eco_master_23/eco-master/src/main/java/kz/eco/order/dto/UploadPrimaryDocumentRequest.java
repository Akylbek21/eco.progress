package kz.eco.order.dto;

public record UploadPrimaryDocumentRequest(
        String fileName,
        String clientComment
) {}
