package kz.ecoprogress.documentflow.admin.dto;

import kz.ecoprogress.documentflow.plan.BillingPeriod;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.plan.PlanFeature;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;

import java.math.BigDecimal;
import java.util.List;

public record PlanAdminDto(
        Long id,
        String code,
        String nameRu,
        String nameKk,
        String descriptionRu,
        String descriptionKk,
        BillingPeriod billingPeriod,
        BigDecimal price,
        String currency,
        int trialDays,
        boolean active,
        boolean visible,
        int sortOrder,
        List<FeatureRow> features
) {
    public record FeatureRow(FeatureCode code, boolean enabled, Long limitValue, String metadataJson) {
        public static FeatureRow from(PlanFeature f) {
            return new FeatureRow(f.getFeatureCode(), f.isEnabled(), f.getLimitValue(), f.getMetadataJson());
        }
    }

    public static PlanAdminDto from(SubscriptionPlan plan, List<PlanFeature> features) {
        return new PlanAdminDto(plan.getId(), plan.getCode(), plan.getNameRu(), plan.getNameKk(),
                plan.getDescriptionRu(), plan.getDescriptionKk(), plan.getBillingPeriod(), plan.getPrice(),
                plan.getCurrency(), plan.getTrialDays(), plan.isActive(), plan.isVisible(), plan.getSortOrder(),
                features.stream().map(FeatureRow::from).toList());
    }
}
