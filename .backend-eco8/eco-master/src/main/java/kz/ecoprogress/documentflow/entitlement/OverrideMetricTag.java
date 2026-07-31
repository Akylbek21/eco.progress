package kz.ecoprogress.documentflow.entitlement;

/**
 * Documented deviation from the literal field list in the module spec: {@code
 * organization_plan_overrides.metric} is a small addition (nullable string, one of
 * {@link kz.ecoprogress.documentflow.usage.UsageMetric} names) not present in the ticket's field
 * list for that table. It exists solely to disambiguate the two metrics
 * (STORAGE_BYTES, ACTIVE_MEMBERS) that share {@link kz.ecoprogress.documentflow.plan.FeatureCode}
 * #CUSTOM_LIMITS - since FeatureCode itself is a stable cross-agent contract value set and can't
 * gain two more entries just for this. For the three metrics with a dedicated FeatureCode
 * (DOCUMENT_CREATE/MULTI_SIGNING/EXTERNAL_SIGNING) this column is left null and the featureCode
 * alone identifies the metric. See UsageLimitService#effectiveLimit for how it's read.
 */
public final class OverrideMetricTag {
    private OverrideMetricTag() {
    }
}
