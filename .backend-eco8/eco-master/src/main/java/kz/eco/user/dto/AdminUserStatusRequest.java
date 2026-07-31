package kz.eco.user.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminUserStatusRequest(
        @NotBlank(message = "Статус обязателен")
        String status
) {
}
