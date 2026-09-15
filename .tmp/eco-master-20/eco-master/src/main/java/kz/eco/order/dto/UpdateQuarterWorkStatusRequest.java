package kz.eco.order.dto;

import jakarta.validation.constraints.NotNull;
import kz.eco.order.WorkStatus;

public record UpdateQuarterWorkStatusRequest(
        @NotNull WorkStatus workStatus,
        String comment
) {}
