package kz.eco.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
        @NotBlank(message = "Email обязателен")
        @Email(message = "Некорректный email")
        String email
) {
}
