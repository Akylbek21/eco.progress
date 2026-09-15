package kz.ecoprogress.documentflow.entitlement;

import kz.ecoprogress.documentflow.plan.FeatureCode;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure-JUnit coverage (no Spring context) for the entitlement-vs-plan priority rule: an active
 * entitlement overrides the plan's own flag in BOTH directions.
 */
class EntitlementResolverTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 6, 1, 12, 0);

    private OrganizationEntitlement entitlement(boolean enabled, LocalDateTime starts, LocalDateTime expires, LocalDateTime createdAt) {
        OrganizationEntitlement e = new OrganizationEntitlement();
        e.setFeatureCode(FeatureCode.EXTERNAL_SIGNING);
        e.setEnabled(enabled);
        e.setStartsAt(starts);
        e.setExpiresAt(expires);
        e.setCreatedAt(createdAt);
        return e;
    }

    @Test
    void planEnabled_noEntitlement_staysEnabled() {
        assertTrue(EntitlementResolver.resolveEnabled(Boolean.TRUE, List.of(), NOW));
    }

    @Test
    void planDisabled_noEntitlement_staysDisabled() {
        assertFalse(EntitlementResolver.resolveEnabled(Boolean.FALSE, List.of(), NOW));
    }

    @Test
    void planMissing_noEntitlement_defaultsDisabled() {
        assertFalse(EntitlementResolver.resolveEnabled(null, List.of(), NOW));
    }

    @Test
    void activeEntitlement_enablesFeature_thePlanDoesNotHave() {
        OrganizationEntitlement active = entitlement(true, null, null, NOW.minusDays(1));
        assertTrue(EntitlementResolver.resolveEnabled(Boolean.FALSE, List.of(active), NOW));
    }

    @Test
    void activeEntitlement_disablesFeature_thePlanDoesHave() {
        OrganizationEntitlement active = entitlement(false, null, null, NOW.minusDays(1));
        assertFalse(EntitlementResolver.resolveEnabled(Boolean.TRUE, List.of(active), NOW));
    }

    @Test
    void expiredEntitlement_isIgnored_fallsBackToPlan() {
        OrganizationEntitlement expired = entitlement(true, null, NOW.minusDays(1), NOW.minusDays(10));
        assertFalse(EntitlementResolver.resolveEnabled(Boolean.FALSE, List.of(expired), NOW));
    }

    @Test
    void notYetStartedEntitlement_isIgnored_fallsBackToPlan() {
        OrganizationEntitlement future = entitlement(true, NOW.plusDays(1), null, NOW.minusDays(1));
        assertFalse(EntitlementResolver.resolveEnabled(Boolean.FALSE, List.of(future), NOW));
    }

    @Test
    void multipleActiveEntitlements_mostRecentlyCreatedWins() {
        OrganizationEntitlement older = entitlement(true, null, null, NOW.minusDays(5));
        OrganizationEntitlement newer = entitlement(false, null, null, NOW.minusDays(1));
        assertFalse(EntitlementResolver.resolveEnabled(Boolean.TRUE, List.of(older, newer), NOW));
    }
}
