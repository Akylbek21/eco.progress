package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.time.LocalDateTime;
import java.util.List;

public record EntitlementsRequest(@NotEmpty @Valid List<EntitlementInput> entitlements) {

    public record EntitlementInput(
            @NotNull FeatureCode featureCode,
            @NotNull Boolean enabled,
            LocalDateTime startsAt,
            LocalDateTime expiresAt,
            String reason
    ) {
    }
}
