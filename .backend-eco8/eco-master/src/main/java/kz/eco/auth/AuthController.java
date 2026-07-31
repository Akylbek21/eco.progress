package kz.eco.auth;

import jakarta.validation.Valid;
import kz.eco.auth.dto.AuthResponse;
import kz.eco.auth.dto.LoginRequest;
import kz.eco.auth.dto.RegisterRequest;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.eco.user.dto.UserResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request, false), "Вход выполнен");
    }

    @PostMapping("/staff/login")
    public ApiResponse<AuthResponse> staffLogin(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request, true), "Вход сотрудника выполнен");
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request), "Кабинет клиента создан");
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        return ApiResponse.message("Вы вышли из системы");
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me() {
        User user = CurrentUser.get();
        return ApiResponse.ok(UserResponse.from(user));
    }
}
