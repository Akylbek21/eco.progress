package kz.eco.order.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AddQuarterPaymentRequest(
        @NotNull BigDecimal amount,
        String method,
        String comment
) {}
