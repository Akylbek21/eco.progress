package kz.eco.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminUserCreateRequest(
        @NotBlank(message = "Email обязателен")
        @Email(message = "Некорректный email")
        @Size(max = 160)
        String email,
        @NotBlank(message = "Пароль обязателен")
        @Size(min = 6, max = 100, message = "Пароль должен быть от 6 символов")
        String password,
        @NotBlank(message = "Имя обязательно")
        @Size(max = 200)
        String name,
        @Size(max = 40)
        String phone,
        @Size(max = 80)
        String city,
        @Size(max = 300)
        String legalAddress,
        @NotBlank(message = "Роль обязательна")
        @Size(max = 30)
        String role,
        @Size(max = 120)
        String position,
        @Size(max = 20)
        String status,
        @Size(max = 20)
        String type,
        @Size(max = 200)
        String companyName,
        @Size(max = 20)
        String bin,
        @Size(max = 80)
        String organizationType
) {
}
