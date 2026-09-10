package kz.eco.order.dto;

import jakarta.validation.constraints.NotNull;
import kz.eco.order.PaymentStatus;

public record UpdateOrderPaymentRequest(
        @NotNull PaymentStatus paymentStatus,
        String paymentMethod
) {}
