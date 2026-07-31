package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;

public record ChangePlanRequest(@NotBlank String planCode, String reason) {
}
