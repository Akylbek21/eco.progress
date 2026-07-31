package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateLabResultStatusRequest(
        @NotBlank String status,
        String comment
) {}
