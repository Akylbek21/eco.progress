package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record AddQuarterResultRequest(
        @NotBlank String title,
        String description,
        String resultType
) {}
