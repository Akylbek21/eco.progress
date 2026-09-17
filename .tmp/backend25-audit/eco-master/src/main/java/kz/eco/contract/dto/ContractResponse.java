package kz.eco.contract.dto;

import kz.eco.contract.Contract;
import kz.eco.contract.ContractQuarter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ContractResponse(
        Long id,
        String contractNumber,
        String orderId,
        String clientCompanyName,
        String clientBin,
        String ourCompanyId,
        String ourCompanyName,
        String contractType,
        String status,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        String serviceName,
        String responsibleManager,
        List<QuarterItemResponse> quarterlySchedule,
        String createdAt,
        String updatedAt
) {
    public static ContractResponse from(Contract c, String companyName, String bin, String ourName, String service) {
        return new ContractResponse(
                c.getId(),
                c.getContractNumber(),
                c.getOrderId(),
                companyName,
                bin,
                c.getBusinessCompanyId(),
                ourName,
                c.getContractType(),
                c.getStatus(),
                c.getStartsAt(),
                c.getEndsAt(),
                c.getTotalAmount(),
                c.getPaidAmount(),
                c.getRemainingAmount(),
                service,
                c.getResponsibleManager() != null ? c.getResponsibleManager().getName() : null,
                c.getQuarters().stream().map(QuarterItemResponse::from).toList(),
                c.getCreatedAt().toString(),
                c.getUpdatedAt().toString()
        );
    }

    public record QuarterItemResponse(
            Long id,
            Long contractId,
            String orderId,
            int quarter,
            String quarterLabel,
            LocalDate periodStart,
            LocalDate periodEnd,
            String serviceName,
            String workStage,
            BigDecimal plannedAmount,
            BigDecimal paidAmount,
            BigDecimal remainingAmount,
            String paymentStatus,
            String invoiceNumber,
            LocalDate invoiceDate,
            LocalDate dueDate,
            String workStatus,
            String comment,
            LocalDate lastPaymentDate,
            String completedAt
    ) {
        public static QuarterItemResponse from(ContractQuarter q) {
            return new QuarterItemResponse(
                    q.getId(),
                    q.getContract().getId(),
                    q.getOrderId(),
                    q.getQuarter(),
                    q.getQuarterLabel(),
                    q.getPeriodStart(),
                    q.getPeriodEnd(),
                    q.getServiceName(),
                    q.getWorkStage(),
                    q.getPlannedAmount(),
                    q.getPaidAmount(),
                    q.getRemainingAmount(),
                    q.getPaymentStatus().name(),
                    q.getInvoiceNumber(),
                    q.getInvoiceDate(),
                    q.getDueDate(),
                    q.getWorkStatus().name(),
                    q.getComment(),
                    q.getLastPaymentDate(),
                    q.getCompletedAt() != null ? q.getCompletedAt().toString() : null
            );
        }
    }
}
