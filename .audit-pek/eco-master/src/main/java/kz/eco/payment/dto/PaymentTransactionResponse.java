package kz.eco.payment.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.payment.PaymentTransaction;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentTransactionResponse(
        Long id,
        Long paymentId,
        Long contractId,
        Long contractQuarterId,
        Long orderQuarterId,
        BigDecimal amount,
        String method,
        LocalDate paidAt,
        String comment,
        String createdByName,
        String createdAt
) {
    public static PaymentTransactionResponse from(PaymentTransaction t) {
        return new PaymentTransactionResponse(
                t.getId(),
                t.getPaymentId(),
                t.getContractId(),
                t.getContractQuarterId(),
                t.getOrderQuarterId(),
                t.getAmount(),
                t.getMethod(),
                t.getPaidAt(),
                t.getComment(),
                t.getCreatedByName(),
                RuDateFormatter.formatDateTime(t.getCreatedAt())
        );
    }
}
