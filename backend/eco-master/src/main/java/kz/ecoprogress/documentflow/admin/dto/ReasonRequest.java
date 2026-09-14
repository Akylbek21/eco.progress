package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Shared body shape for suspend/restore/revoke - all take a reason plus the optimistic-lock
 *  {@code expectedVersion} the client last saw for this organization's subscription (from
 *  {@link AdminOrganizationAccessDto#subscriptionVersion()}); a mismatch throws a
 *  VERSION_CONFLICT-coded {@link kz.eco.common.exception.ConflictException}. */
public record ReasonRequest(@NotBlank String reason, @NotNull Long expectedVersion) {
}
