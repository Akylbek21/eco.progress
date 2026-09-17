package kz.ecoprogress.documentflow.access;

import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Full snapshot of what a user can currently do inside the document-flow module for one
 * organization. This is the stable contract Agents B and C build their document/signing access
 * checks against - do not rename/remove fields without reconciling with them.
 *
 * @param authenticated       whether a real user id was resolved (false only if called with a
 *                            null/anonymous user - should not normally happen behind the JWT filter).
 * @param organizationId      the organization this context describes; null only when authenticated
 *                            is false or no organization could be resolved at all.
 * @param membershipId        the caller's {@code document_flow_memberships} row id, or null if the
 *                            user has no membership in this organization at all.
 * @param role                the caller's {@link MembershipRole} in this organization, or null if
 *                            no membership exists (module spec §4: exposed so the frontend doesn't
 *                            have to re-derive it from the permission set).
 * @param membershipStatus    the caller's {@link MembershipStatus}, or null if no membership row
 *                            exists at all (as opposed to existing but REMOVED, which this service
 *                            already treats as "no membership" upstream).
 * @param subscriptionStatus  current {@link SubscriptionStatus}, or null if the organization has
 *                            never had a subscription row.
 * @param readOnly            true if write operations are blocked (EXPIRED/CANCELLED) - read access
 *                            may still be allowed; see {@link DocumentFlowAccessService} javadoc.
 * @param plan                {code, name} of the organization's current plan, or null.
 * @param features            the resolved set of enabled {@link FeatureCode}s (plan + entitlement
 *                            overrides already applied).
 * @param permissions         the caller's {@link DocumentFlowPermission}s from their membership role.
 * @param limits               effective numeric limit per {@link UsageMetric}; a missing/null entry
 *                            means unlimited.
 * @param usage               current-period usage counters per {@link UsageMetric}.
 * @param availableActions    human/UI-facing action codes the caller can currently perform - derived
 *                            from permissions, exposed as plain strings for frontend convenience.
 * @param startsAt            subscription start, or null.
 * @param expiresAt           subscription/grace end (whichever is the operative "access ends at"
 *                            for the current status), or null.
 * @param daysRemaining        whole days between now and expiresAt, or null if expiresAt is null.
 * @param reason               nullable human-readable explanation when access is denied/limited/warned
 *                            (e.g. "Подписка приостановлена", "Действует льготный период до ...").
 * @param testOverride         true only when access was granted via the DEV/TEST allowlist bypass
 *                            (see {@link DocumentFlowTestAccessProperties}) rather than a real
 *                            subscription - never true in the {@code docker} (production) profile,
 *                            see {@link DocumentFlowTestAccessGuard}. Membership is still real and
 *                            required either way; this only ever substitutes for the subscription
 *                            check, never for tenant/membership isolation.
 */
public record AccessContext(
        boolean authenticated,
        Long organizationId,
        Long membershipId,
        MembershipRole role,
        MembershipStatus membershipStatus,
        SubscriptionStatus subscriptionStatus,
        boolean readOnly,
        PlanSummary plan,
        Set<FeatureCode> features,
        Set<DocumentFlowPermission> permissions,
        Map<UsageMetric, Long> limits,
        Map<UsageMetric, Long> usage,
        List<String> availableActions,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        Long daysRemaining,
        String reason,
        boolean testOverride
) {
    public record PlanSummary(String code, String name) {
    }

    public boolean canOpenModule() {
        // A SUSPENDED/INVITED membership must not be able to open the module even if it somehow
        // still resolves to a row here (getAccessContext keeps non-REMOVED memberships around so
        // it can still report role/status) - this mirrors the ACTIVE-only rule
        // DocumentFlowAccessServiceImpl.requireMembership already enforces on every write path
        // (module spec §4/§23: suspended/removed membership must not access the module at all).
        if (!authenticated || organizationId == null || membershipId == null
                || membershipStatus != MembershipStatus.ACTIVE) {
            return false;
        }
        if (testOverride) {
            return true;
        }
        return subscriptionStatus != null
                && subscriptionStatus != SubscriptionStatus.SUSPENDED
                && subscriptionStatus != SubscriptionStatus.PENDING;
    }
}
