package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import kz.ecoprogress.documentflow.plan.BillingPeriod;
import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.math.BigDecimal;
import java.util.Map;

public record PlanCreateRequest(
        @NotBlank String code,
        @NotBlank String nameRu,
        @NotBlank String nameKk,
        String descriptionRu,
        String descriptionKk,
        @NotNull BillingPeriod billingPeriod,
        @NotNull @PositiveOrZero BigDecimal price,
        @NotBlank String currency,
        @PositiveOrZero int trialDays,
        boolean active,
        boolean visible,
        int sortOrder,
        Map<FeatureCode, PlanFeatureRequest> features
) {
    public record PlanFeatureRequest(@NotNull Boolean enabled, Long limitValue, String metadataJson) {
    }
}
