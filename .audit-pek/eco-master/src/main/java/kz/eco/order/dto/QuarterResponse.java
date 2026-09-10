package kz.eco.order.dto;

import kz.eco.common.util.RuDateFormatter;
import kz.eco.order.DocumentVisibility;
import kz.eco.order.CommentVisibility;
import kz.eco.order.OrderComment;
import kz.eco.order.OrderQuarter;
import kz.eco.order.PaymentStatus;
import kz.eco.order.WorkStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record QuarterResponse(
        Long id,
        int quarter,
        String quarterLabel,
        LocalDate periodStart,
        LocalDate periodEnd,
        String serviceName,
        String workStage,
        WorkStatus workStatus,
        PaymentStatus paymentStatus,
        BigDecimal plannedAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        String invoiceNumber,
        LocalDate invoiceDate,
        LocalDate dueDate,
        LocalDate lastPaymentDate,
        String responsibleEmployeeName,
        String startedAt,
        String completedAt,
        List<QuarterDocumentResponse> documents,
        List<QuarterResultResponse> results,
        List<CommentResponse> comments
) {
    public static QuarterResponse from(OrderQuarter q, boolean isClient, List<OrderComment> orderComments) {
        List<QuarterDocumentResponse> docs = q.getQuarterDocuments().stream()
                .filter(d -> !isClient || d.getVisibility() != DocumentVisibility.internal)
                .map(QuarterDocumentResponse::from)
                .toList();

        List<QuarterResultResponse> results = q.getQuarterResults().stream()
                .map(QuarterResultResponse::from)
                .toList();

        List<CommentResponse> comments = orderComments.stream()
                .filter(c -> c.getOrderQuarter() != null && c.getOrderQuarter().getId().equals(q.getId()))
                .filter(c -> !isClient || c.getVisibility() != CommentVisibility.internal)
                .map(CommentResponse::from)
                .toList();

        return new QuarterResponse(
                q.getId(),
                q.getQuarter(),
                q.getQuarterLabel(),
                q.getPeriodStart(),
                q.getPeriodEnd(),
                q.getServiceName(),
                q.getWorkStage(),
                q.getWorkStatus(),
                q.getPaymentStatus(),
                q.getPlannedAmount(),
                q.getPaidAmount(),
                q.getRemainingAmount(),
                q.getInvoiceNumber(),
                q.getInvoiceDate(),
                q.getDueDate(),
                q.getLastPaymentDate(),
                q.getResponsibleEmployeeName(),
                RuDateFormatter.formatDateTime(q.getStartedAt()),
                RuDateFormatter.formatDateTime(q.getCompletedAt()),
                docs,
                results,
                comments
        );
    }
}
