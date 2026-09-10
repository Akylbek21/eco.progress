package kz.ecoprogress.documentflow.plan;

/**
 * Every gate-able capability of the "Документооборот" module. A plan enables/disables each of
 * these via {@link PlanFeature#isEnabled()}; an active {@code organization_entitlements} row can
 * override the plan's flag in either direction (see kz.ecoprogress.documentflow.entitlement.
 * EntitlementResolver for the exact priority rule).
 */
public enum FeatureCode {
    /** Master gate: can the organization open the module at all. */
    DOCUMENT_FLOW,
    DOCUMENT_CREATE,
    MULTI_SIGNING,
    SEQUENTIAL_SIGNING,
    PARALLEL_SIGNING,
    MIXED_SIGNING,
    EXTERNAL_SIGNING,
    NCALAYER_SIGNING,
    DOCUMENT_TEMPLATES,
    VERSIONING,
    REVOCATION,
    AUDIT_LOG,
    API_ACCESS,
    CRM_INTEGRATION,
    /** Plan supports admin-granted custom overrides beyond the plan's own limits/features. */
    CUSTOM_LIMITS
}
