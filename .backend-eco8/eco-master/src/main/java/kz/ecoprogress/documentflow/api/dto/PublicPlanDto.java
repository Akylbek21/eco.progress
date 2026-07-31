package kz.ecoprogress.documentflow.api.dto;

import kz.ecoprogress.documentflow.plan.BillingPeriod;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;

import java.math.BigDecimal;
import java.util.List;

/** Prospective-customer-safe view of a plan - no metadataJson, no internal limitValue plumbing,
 *  just which features are on and (where meaningful) their plain limit number. */
public record PublicPlanDto(
        String code,
        String nameRu,
        String nameKk,
        String descriptionRu,
        String descriptionKk,
        BillingPeriod billingPeriod,
        BigDecimal price,
        String currency,
        int trialDays,
        List<PublicPlanFeatureDto> features
) {
    public record PublicPlanFeatureDto(FeatureCode code, boolean enabled, Long limitValue) {
    }

    public static PublicPlanDto from(SubscriptionPlan plan, List<PublicPlanFeatureDto> features) {
        return new PublicPlanDto(plan.getCode(), plan.getNameRu(), plan.getNameKk(),
                plan.getDescriptionRu(), plan.getDescriptionKk(), plan.getBillingPeriod(),
                plan.getPrice(), plan.getCurrency(), plan.getTrialDays(), features);
    }
}
