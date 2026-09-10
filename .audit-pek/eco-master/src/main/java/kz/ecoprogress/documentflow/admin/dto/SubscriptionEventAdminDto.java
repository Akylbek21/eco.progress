package kz.ecoprogress.documentflow.admin.dto;

import kz.ecoprogress.documentflow.subscription.SubscriptionEvent;
import kz.ecoprogress.documentflow.subscription.SubscriptionEventType;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;

import java.time.LocalDateTime;

public record SubscriptionEventAdminDto(
        Long id,
        Long subscriptionId,
        Long organizationId,
        SubscriptionEventType eventType,
        SubscriptionStatus oldStatus,
        SubscriptionStatus newStatus,
        String reason,
        Long actorUserId,
        LocalDateTime createdAt
) {
    public static SubscriptionEventAdminDto from(SubscriptionEvent e) {
        return new SubscriptionEventAdminDto(e.getId(), e.getSubscriptionId(), e.getOrganizationId(),
                e.getEventType(), e.getOldStatus(), e.getNewStatus(), e.getReason(), e.getActorUserId(), e.getCreatedAt());
    }
}
