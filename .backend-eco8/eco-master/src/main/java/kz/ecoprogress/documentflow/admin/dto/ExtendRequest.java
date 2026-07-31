package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record ExtendRequest(@NotNull LocalDateTime newExpiresAt, String reason) {
}
