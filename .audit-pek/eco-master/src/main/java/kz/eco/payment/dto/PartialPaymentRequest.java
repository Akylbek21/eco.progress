package kz.eco.payment.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PartialPaymentRequest(
        @NotNull BigDecimal amount,
        String method,
        String comment
) {}
