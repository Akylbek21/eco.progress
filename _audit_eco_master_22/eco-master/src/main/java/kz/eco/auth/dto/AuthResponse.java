package kz.eco.auth.dto;

import kz.eco.user.dto.UserResponse;

public record AuthResponse(String token, UserResponse user) {
}
