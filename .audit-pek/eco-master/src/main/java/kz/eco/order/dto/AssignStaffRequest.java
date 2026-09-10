package kz.eco.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AssignStaffRequest(
        @NotBlank String role,
        @NotNull Long userId
) {}
