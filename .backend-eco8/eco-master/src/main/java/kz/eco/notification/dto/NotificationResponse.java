package kz.eco.notification.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.notification.Notification;

public record NotificationResponse(
        Long id,
        Long userId,
        String role,
        String orderId,
        String title,
        String message,
        String type,
        boolean isRead,
        String createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getUserId(),
                n.getRole(),
                n.getOrderId(),
                n.getTitle(),
                n.getMessage(),
                n.getType(),
                n.isRead(),
                RuDateFormatter.formatDateTime(n.getCreatedAt())
        );
    }
}
