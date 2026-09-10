package kz.ecoprogress.documentflow.admin.dto;

import kz.ecoprogress.documentflow.admin.AdminSubscriptionActionResolver;
import kz.ecoprogress.documentflow.plan.SubscriptionPlan;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.PaymentMode;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Organization-centric replacement for {@code AccessContextDto} on every admin mutation/read
 * endpoint under {@code /api/admin/document-flow/**}. Unlike {@code AccessContext} (which is
 * inherently tied to one user's membership/permissions), this describes the organization's
 * subscription/access state as a whole and never depends on which membership row happened to be
 * picked first - see AdminSubscriptionService.contextForOrganization's javadoc for the bug this
 * replaces. The user-facing {@code GET /api/document-flow/access} endpoint keeps returning
 * {@code AccessContextDto} unchanged.
 */
public record AdminOrganizationAccessDto(
        Long organizationId,
        boolean hasSubscription,
        Long subscriptionId,
        Long subscriptionVersion,
        SubscriptionStatus subscriptionStatus,
        Long planId,
        String planCode,
        String planName,
        boolean available,
        boolean readOnly,
        String reason,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        LocalDateTime graceEndsAt,
        PaymentMode paymentMode,
        String paymentReference,
        long activeMemberCount,
        boolean hasOwner,
        Map<UsageMetric, Long> limits,
        Map<UsageMetric, Long> usage,
        List<String> availableAdminActions,
        boolean subscriptionActive,
        boolean hasActiveMembers,
        boolean organizationReady,
        Long ownerUserId,
        Long membershipId,
        Long invitationId
) {

    /** No-subscription shape - still a normal 200 response, not a 404 (an organization with no
     *  subscription at all is a legitimate, common state for a brand-new organization). */
    public static AdminOrganizationAccessDto noSubscription(Long organizationId, long activeMemberCount, boolean hasOwner) {
        return new AdminOrganizationAccessDto(organizationId, false, null, null, null,
                null, null, null, false, true, "Нет активной подписки",
                null, null, null, null, null,
                activeMemberCount, hasOwner, Map.of(), Map.of(),
                AdminSubscriptionActionResolver.resolve(false, null),
                false, activeMemberCount > 0, activeMemberCount > 0 && hasOwner, null, null, null);
    }

    public static AdminOrganizationAccessDto from(OrganizationSubscription subscription, SubscriptionPlan plan,
                                                    boolean available, boolean readOnly, String reason,
                                                    long activeMemberCount, boolean hasOwner,
                                                    Map<UsageMetric, Long> limits, Map<UsageMetric, Long> usage,
                                                    Long ownerUserId, Long membershipId, Long invitationId) {
        boolean subscriptionActive = subscription.getStatus() == SubscriptionStatus.ACTIVE
                || subscription.getStatus() == SubscriptionStatus.TRIAL
                || subscription.getStatus() == SubscriptionStatus.GRACE_PERIOD;
        return new AdminOrganizationAccessDto(subscription.getOrganizationId(), true, subscription.getId(),
                subscription.getVersion(), subscription.getStatus(),
                plan != null ? plan.getId() : subscription.getPlanId(),
                plan != null ? plan.getCode() : null,
                plan != null ? plan.getNameRu() : null,
                available, readOnly, reason,
                subscription.getStartsAt(), subscription.getExpiresAt(), subscription.getGraceEndsAt(),
                subscription.getPaymentMode(), subscription.getPaymentReference(),
                activeMemberCount, hasOwner, limits, usage,
                AdminSubscriptionActionResolver.resolve(true, subscription.getStatus()),
                subscriptionActive, activeMemberCount > 0, activeMemberCount > 0 && hasOwner,
                ownerUserId, membershipId, invitationId);
    }
}
