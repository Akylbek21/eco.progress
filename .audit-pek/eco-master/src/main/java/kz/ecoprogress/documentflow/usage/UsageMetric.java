package kz.ecoprogress.documentflow.usage;

import kz.ecoprogress.documentflow.plan.FeatureCode;

/**
 * A countable resource tracked per organization in {@code organization_usage}. Each metric maps
 * to the {@link FeatureCode} whose {@code plan_features.limitValue} (or, for the two metrics with
 * no dedicated feature row, the {@code CUSTOM_LIMITS} feature's {@code metadataJson}) carries the
 * plan's baseline limit - see {@link UsageLimitService} javadoc for the full mapping and the
 * reasoning behind the CUSTOM_LIMITS special case.
 */
public enum UsageMetric {
    DOCUMENTS_CREATED(FeatureCode.DOCUMENT_CREATE),
    SIGNATURES_CREATED(FeatureCode.MULTI_SIGNING),
    EXTERNAL_SIGNATURES_CREATED(FeatureCode.EXTERNAL_SIGNING),
    /** No dedicated FeatureCode exists for storage - limit lives in CUSTOM_LIMITS.metadataJson. */
    STORAGE_BYTES(FeatureCode.CUSTOM_LIMITS),
    /** No dedicated FeatureCode exists for member headcount - limit lives in CUSTOM_LIMITS.metadataJson. */
    ACTIVE_MEMBERS(FeatureCode.CUSTOM_LIMITS);

    private final FeatureCode limitFeature;

    UsageMetric(FeatureCode limitFeature) {
        this.limitFeature = limitFeature;
    }

    public FeatureCode limitFeature() {
        return limitFeature;
    }

    public String code() {
        return switch (this) {
            case DOCUMENTS_CREATED -> "DOCUMENT_LIMIT_EXCEEDED";
            case SIGNATURES_CREATED -> "SIGNATURE_LIMIT_EXCEEDED";
            case EXTERNAL_SIGNATURES_CREATED -> "EXTERNAL_SIGNATURE_LIMIT_EXCEEDED";
            case STORAGE_BYTES -> "STORAGE_LIMIT_EXCEEDED";
            case ACTIVE_MEMBERS -> "MEMBER_LIMIT_EXCEEDED";
        };
    }
}
