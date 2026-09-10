package kz.ecoprogress.documentflow.entitlement;

import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Pure, Spring-free feature-enablement priority logic - deliberately a plain static method (no
 * repositories, no beans) so it's unit-testable without a Spring context.
 *
 * Hard business rule (implement exactly, per the module spec):
 *   1. An active {@code organization_entitlements} row for the feature (enabled=true or false,
 *      now between startsAt/expiresAt) OVERRIDES the plan's feature flag in both directions - it
 *      can enable a feature the plan doesn't have, or disable one the plan does have.
 *   2. Otherwise fall back to the plan's {@code plan_features.enabled} flag.
 *   3. Otherwise (no plan feature row either) default to disabled.
 */
public final class EntitlementResolver {

    private EntitlementResolver() {
    }

    /**
     * @param planFeatureEnabled null if the plan has no row at all for this feature (treated as
     *                           disabled), otherwise the plan's own enabled flag.
     * @param entitlements       all entitlement rows for the organization+feature (any number,
     *                           including zero) - only rows currently active (per
     *                           {@link OrganizationEntitlement#isCurrentlyActive}) are considered.
     *                           If more than one is active, the most recently created one wins.
     */
    public static boolean resolveEnabled(Boolean planFeatureEnabled, List<OrganizationEntitlement> entitlements, LocalDateTime now) {
        OrganizationEntitlement activeOverride = entitlements.stream()
                .filter(e -> e.isCurrentlyActive(now))
                .max((a, b) -> {
                    LocalDateTime ca = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime cb = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                    return ca.compareTo(cb);
                })
                .orElse(null);

        if (activeOverride != null) {
            return activeOverride.isEnabled();
        }
        return planFeatureEnabled != null && planFeatureEnabled;
    }

    public static boolean resolveEnabled(FeatureCode feature, Boolean planFeatureEnabled,
                                          List<OrganizationEntitlement> allOrgEntitlements, LocalDateTime now) {
        List<OrganizationEntitlement> forFeature = allOrgEntitlements.stream()
                .filter(e -> e.getFeatureCode() == feature)
                .toList();
        return resolveEnabled(planFeatureEnabled, forFeature, now);
    }
}
