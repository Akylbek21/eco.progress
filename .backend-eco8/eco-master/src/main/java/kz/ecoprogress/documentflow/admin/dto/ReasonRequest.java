package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;

/** Shared body shape for suspend/restore/revoke - all take just a reason. */
public record ReasonRequest(@NotBlank String reason) {
}
