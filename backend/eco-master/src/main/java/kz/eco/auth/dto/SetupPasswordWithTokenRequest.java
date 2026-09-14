package kz.eco.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body form of the setup-password call ({@code POST /api/auth/setup-password}), where the
 *  one-time token travels in the JSON body instead of the URL path. Preferred over the
 *  path-variable variant because the raw token then never lands in access logs, proxy logs,
 *  or browser history. The path variant is kept for already-issued links. */
public record SetupPasswordWithTokenRequest(
        @NotBlank(message = "Токен обязателен")
        @Size(max = 200)
        String token,
        @NotBlank(message = "Пароль обязателен")
        @Size(min = 8, max = 100, message = "Пароль должен быть от 8 символов")
        String password
) {
}
