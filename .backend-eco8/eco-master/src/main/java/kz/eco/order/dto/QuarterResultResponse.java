package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.QuarterResult;

public record QuarterResultResponse(
        Long id,
        String title,
        String description,
        String resultType,
        String createdByName,
        String createdAt
) {
    public static QuarterResultResponse from(QuarterResult r) {
        return new QuarterResultResponse(
                r.getId(),
                r.getTitle(),
                r.getDescription(),
                r.getResultType(),
                r.getCreatedByName(),
                RuDateFormatter.formatDateTime(r.getCreatedAt())
        );
    }
}
