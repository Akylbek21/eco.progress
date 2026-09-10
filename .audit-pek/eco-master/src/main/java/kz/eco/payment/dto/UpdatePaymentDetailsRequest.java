package kz.eco.payment.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdatePaymentDetailsRequest(
        String invoiceNumber,
        String serviceName,
        BigDecimal totalAmount,
        String paymentMethod,
        String paymentStatus,
        LocalDate invoiceDate,
        LocalDate dueDate,
        String comment
) {}
