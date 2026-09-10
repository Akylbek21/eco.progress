package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record RequestPrimaryDocumentRequest(
        @NotBlank String name,
        boolean required,
        String comment
) {}
