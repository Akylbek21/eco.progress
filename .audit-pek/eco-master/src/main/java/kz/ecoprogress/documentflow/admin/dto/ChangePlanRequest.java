package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ChangePlanRequest(@NotBlank String planCode, String reason, @NotNull Long expectedVersion) {
}
