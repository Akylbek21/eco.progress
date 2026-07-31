package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UploadLabResultRequest(
        @NotBlank String name,
        String section,
        String quarter,
        String fileName
) {}
