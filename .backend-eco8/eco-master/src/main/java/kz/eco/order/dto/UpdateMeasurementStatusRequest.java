package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateMeasurementStatusRequest(
        @NotBlank String status,
        String comment
) {}
