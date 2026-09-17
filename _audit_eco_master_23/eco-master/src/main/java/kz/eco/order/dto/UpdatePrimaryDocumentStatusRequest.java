package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePrimaryDocumentStatusRequest(
        @NotBlank String status,
        String comment,
        String managerComment
) {
    public String resolvedComment() {
        if (managerComment != null && !managerComment.isBlank()) return managerComment;
        return comment;
    }
}
