package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;

public record RespondMeasurementRequest(
        @NotBlank String status,
        String comment,
        String rescheduleDate,
        String rescheduleTime,
        String rescheduleAddress,
        String rescheduleComment
) {}
