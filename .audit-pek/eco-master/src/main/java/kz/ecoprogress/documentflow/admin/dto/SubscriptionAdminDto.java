package kz.ecoprogress.documentflow.admin.dto;

import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.PaymentMode;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;

import java.time.LocalDateTime;

public record SubscriptionAdminDto(
        Long id,
        Long organizationId,
        Long planId,
        SubscriptionStatus status,
        LocalDateTime startsAt,
        LocalDateTime expiresAt,
        LocalDateTime trialEndsAt,
        LocalDateTime graceEndsAt,
        boolean autoRenew,
        PaymentMode paymentMode,
        String paymentReference,
        Long activatedBy,
        Long suspendedBy,
        String suspensionReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static SubscriptionAdminDto from(OrganizationSubscription s) {
        return new SubscriptionAdminDto(s.getId(), s.getOrganizationId(), s.getPlanId(), s.getStatus(),
                s.getStartsAt(), s.getExpiresAt(), s.getTrialEndsAt(), s.getGraceEndsAt(), s.isAutoRenew(),
                s.getPaymentMode(), s.getPaymentReference(), s.getActivatedBy(), s.getSuspendedBy(),
                s.getSuspensionReason(), s.getCreatedAt(), s.getUpdatedAt());
    }
}
