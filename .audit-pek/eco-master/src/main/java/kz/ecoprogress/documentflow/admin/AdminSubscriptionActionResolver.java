package kz.ecoprogress.documentflow.admin;

import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;

import java.util.List;

/**
 * Computes which admin mutation actions are meaningful to offer for a given
 * (hasSubscription, subscriptionStatus) pair, so the UI does not need to re-derive this logic and
 * every response ({@code AdminOrganizationAccessDto.availableAdminActions}) stays consistent.
 *
 * <p>Action names match the admin endpoint path segments: grant, extend, suspend, restore, revoke,
 * change-plan, limits, entitlements.
 */
public final class AdminSubscriptionActionResolver {

    private AdminSubscriptionActionResolver() {
    }

    public static List<String> resolve(boolean hasSubscription, SubscriptionStatus status) {
        if (!hasSubscription || status == null) {
            return List.of("grant");
        }
        return switch (status) {
            // Non-terminal, healthy/near-healthy states - full management surface available.
            case PENDING, ACTIVE, TRIAL, GRACE_PERIOD ->
                    List.of("extend", "suspend", "revoke", "change-plan", "limits", "entitlements");
            // Suspended can only be restored or revoked outright - not extended (dates are
            // irrelevant while suspended) and not re-granted (grantOrUpdateActive would just
            // reactivate it anyway, so "restore" is the correct, explicit action name).
            case SUSPENDED -> List.of("restore", "revoke", "change-plan", "limits", "entitlements");
            // EXPIRED can be extended in place (SubscriptionService.extend reactivates it to
            // ACTIVE) or re-granted as a fresh access period; limits/entitlements remain editable
            // even while lapsed so they are ready the moment access resumes.
            case EXPIRED -> List.of("extend", "grant", "limits", "entitlements");
            // CANCELLED requires a brand-new grant per module policy - extend() explicitly rejects
            // CANCELLED subscriptions (see SubscriptionService.extend).
            case CANCELLED -> List.of("grant");
        };
    }
}
