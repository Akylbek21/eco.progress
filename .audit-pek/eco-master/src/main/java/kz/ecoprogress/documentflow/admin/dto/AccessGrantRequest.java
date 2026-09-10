package kz.ecoprogress.documentflow.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import kz.ecoprogress.documentflow.subscription.PaymentMode;
import kz.ecoprogress.documentflow.usage.UsageMetric;

import java.time.LocalDateTime;
import java.util.Map;

public record AccessGrantRequest(
        @NotNull Long organizationId,
        @NotBlank String planCode,
        @NotNull LocalDateTime startsAt,
        LocalDateTime expiresAt,
        LocalDateTime graceEndsAt,
        @NotNull PaymentMode paymentMode,
        String paymentReference,
        String reason,
        Map<UsageMetric, Long> limits,
        /** Optional (task item 9): if set, {@code AdminSubscriptionService.assignOwner} creates,
         *  activates, or promotes this user's membership to OWNER in the same transaction as the
         *  grant. Must not be combined with an organization that already has a different ACTIVE
         *  OWNER without the caller explicitly intending to add a second one - this DTO doesn't
         *  reject that case (an organization can have more than one OWNER), it only guarantees
         *  the named user ends up as an ACTIVE OWNER. */
        Long initialOwnerUserId,
        String ownerEmail,
        String ownerFullName
) {
    public AccessGrantRequest(Long organizationId, String planCode, LocalDateTime startsAt,
                              LocalDateTime expiresAt, LocalDateTime graceEndsAt,
                              PaymentMode paymentMode, String paymentReference, String reason,
                              Map<UsageMetric, Long> limits, Long initialOwnerUserId) {
        this(organizationId, planCode, startsAt, expiresAt, graceEndsAt, paymentMode,
                paymentReference, reason, limits, initialOwnerUserId, null, null);
    }
}
