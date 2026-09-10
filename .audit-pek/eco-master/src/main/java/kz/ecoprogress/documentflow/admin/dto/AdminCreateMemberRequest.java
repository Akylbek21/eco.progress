package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminCreateMemberRequest(@NotBlank String email, @NotBlank String role) {
}
