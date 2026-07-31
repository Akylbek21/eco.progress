package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.CommentVisibility;
import kz.eco.order.OrderComment;

public record CommentResponse(
        Long id,
        String authorName,
        String authorRole,
        String text,
        CommentVisibility visibility,
        Long quarterId,
        String createdAt
) {
    public static CommentResponse from(OrderComment c) {
        return new CommentResponse(
                c.getId(),
                c.getAuthorName(),
                c.getAuthorRole(),
                c.getText(),
                c.getVisibility(),
                c.getOrderQuarter() != null ? c.getOrderQuarter().getId() : null,
                RuDateFormatter.formatDateTime(c.getCreatedAt())
        );
    }
}
