package kz.eco.payment.dto;

import kz.eco.order.PaymentStatus;
import kz.eco.payment.Payment;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PaymentResponse(
        Long id,
        String orderId,
        Long contractId,
        String invoiceNumber,
        String serviceName,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        PaymentStatus paymentStatus,
        String paymentMethod,
        LocalDate invoiceDate,
        LocalDate dueDate,
        LocalDate lastPaymentDate,
        String comment,
        String clientEmail
) {
    public static PaymentResponse from(Payment p) {
        return new PaymentResponse(
                p.getId(),
                p.getOrderId(),
                p.getContractId(),
                p.getInvoiceNumber(),
                p.getServiceName(),
                p.getTotalAmount(),
                p.getPaidAmount(),
                p.getRemainingAmount(),
                p.getPaymentStatus(),
                p.getPaymentMethod(),
                p.getInvoiceDate(),
                p.getDueDate(),
                p.getLastPaymentDate(),
                p.getComment(),
                p.getClientEmail()
        );
    }
}
