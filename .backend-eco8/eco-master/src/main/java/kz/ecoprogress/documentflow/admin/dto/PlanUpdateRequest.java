package kz.ecoprogress.documentflow.admin.dto;

import kz.ecoprogress.documentflow.plan.BillingPeriod;
import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.math.BigDecimal;
import java.util.Map;

/** All fields optional/nullable - PATCH semantics, only supplied fields change. */
public record PlanUpdateRequest(
        String nameRu,
        String nameKk,
        String descriptionRu,
        String descriptionKk,
        BillingPeriod billingPeriod,
        BigDecimal price,
        String currency,
        Integer trialDays,
        Boolean active,
        Boolean visible,
        Integer sortOrder,
        Map<FeatureCode, PlanCreateRequest.PlanFeatureRequest> features
) {
}
