package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.OrderHistory;

public record HistoryResponse(
        Long id,
        String text,
        String createdAt
) {
    public static HistoryResponse from(OrderHistory h) {
        return new HistoryResponse(
                h.getId(),
                h.getText(),
                RuDateFormatter.formatDateTime(h.getCreatedAt())
        );
    }
}
