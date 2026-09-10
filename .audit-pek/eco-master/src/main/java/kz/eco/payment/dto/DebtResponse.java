package kz.eco.payment.dto;

import kz.eco.payment.Debt;
import kz.eco.payment.DebtStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DebtResponse(
        Long id,
        String orderId,
        Long contractId,
        Long contractQuarterId,
        Long orderQuarterId,
        String invoiceNumber,
        String quarterLabel,
        BigDecimal amount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        DebtStatus status,
        String reason,
        LocalDate dueDate,
        String comment,
        String clientEmail
) {
    public static DebtResponse from(Debt d) {
        return new DebtResponse(
                d.getId(),
                d.getOrderId(),
                d.getContractId(),
                d.getContractQuarterId(),
                d.getOrderQuarterId(),
                d.getInvoiceNumber(),
                d.getQuarterLabel(),
                d.getAmount(),
                d.getPaidAmount(),
                d.getRemainingAmount(),
                d.getStatus(),
                d.getReason(),
                d.getDueDate(),
                d.getComment(),
                d.getClientEmail()
        );
    }
}
