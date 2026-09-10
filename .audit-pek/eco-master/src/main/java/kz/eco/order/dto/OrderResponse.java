package kz.eco.order.dto;

import kz.eco.client.Client;
import kz.eco.common.util.RuDateFormatter;
import kz.eco.contract.Contract;
import kz.eco.order.*;

import java.math.BigDecimal;
import java.util.List;

public record OrderResponse(
        String id,
        String status,
        String statusLabel,
        ContractType contractType,
        String businessCompanyId,
        String serviceName,
        String serviceId,
        String contactPerson,
        String phone,
        String city,
        String objectAddress,
        String comment,
        String urgency,
        ClientInfo clientInfo,
        ContractInfo contractInfo,
        String managerName,
        String accountantName,
        String ecologistName,
        String laboratoryUserName,
        EcologyStatus ecologyStatus,
        LaboratoryStatus laboratoryStatus,
        ContractStatus contractStatus,
        PaymentStatus paymentStatus,
        BigDecimal paymentAmount,
        String paymentMethod,
        String signatureProvider,
        String signedAt,
        String paidAt,
        CrmContractStatus crmContractStatus,
        String deadline,
        String completedAt,
        String cancelledAt,
        List<QuarterResponse> quarters,
        List<DocumentResponse> documents,
        List<DocumentResponse> agreementDocuments,
        List<DocumentResponse> resultDocuments,
        List<PrimaryDocumentResponse> primaryDocuments,
        List<CommentResponse> comments,
        List<HistoryResponse> history,
        String createdAt,
        String updatedAt
) {
    public record ClientInfo(Long id, String companyName, String contactPerson,
                             String binIin, String email, String phone) {}

    public record ContractInfo(Long id, String number, String status,
                               CrmContractStatus crmStatus,
                               String startsAt, String endsAt,
                               BigDecimal totalAmount, BigDecimal paidAmount,
                               BigDecimal remainingAmount) {}

    public static OrderResponse from(Order o, boolean isClient, Contract contract) {
        return from(o, isClient, contract, null);
    }

    public static OrderResponse from(Order o, boolean isClient, Contract contract,
                                     List<OrderPrimaryDocument> primaryDocs) {
        Client cl = o.getClient();
        ClientInfo clientInfo = cl != null
                ? new ClientInfo(cl.getId(), cl.getCompanyName(), cl.getContactPerson(),
                        cl.getBinIin(), cl.getEmail(), cl.getPhone())
                : null;

        ContractInfo contractInfo = contract != null
                ? new ContractInfo(contract.getId(), contract.getContractNumber(),
                        contract.getStatus(), contract.getCrmStatus(),
                        contract.getStartsAt() != null ? contract.getStartsAt().toString() : null,
                        contract.getEndsAt() != null ? contract.getEndsAt().toString() : null,
                        contract.getTotalAmount(), contract.getPaidAmount(),
                        contract.getRemainingAmount())
                : null;

        var visibleDocs = o.getDocuments().stream()
                .filter(d -> !isClient || d.getVisibility() != DocumentVisibility.internal)
                .filter(d -> !isClient || d.getVisibility() != DocumentVisibility.staff)
                .map(DocumentResponse::from)
                .toList();

        List<DocumentResponse> agreementDocs = visibleDocs.stream()
                .filter(DocumentResponse::isAgreementTab)
                .toList();

        List<DocumentResponse> docs = visibleDocs.stream()
                .filter(d -> d.type() != DocumentType.result)
                .filter(d -> !d.isAgreementTab())
                .toList();

        List<DocumentResponse> resultDocs = visibleDocs.stream()
                .filter(d -> d.type() == DocumentType.result)
                .toList();

        List<CommentResponse> comments = o.getComments().stream()
                .filter(c -> c.getOrderQuarter() == null)
                .filter(c -> !isClient || c.getVisibility() != CommentVisibility.internal)
                .map(CommentResponse::from)
                .toList();

        List<HistoryResponse> history = o.getHistory().stream()
                .map(HistoryResponse::from)
                .toList();

        List<QuarterResponse> quarters = o.getQuarters().stream()
                .map(q -> QuarterResponse.from(q, isClient, o.getComments()))
                .toList();

        List<PrimaryDocumentResponse> primaryDocumentResponses = primaryDocs != null
                ? primaryDocs.stream().map(PrimaryDocumentResponse::from).toList()
                : List.of();

        String paidAt = null;
        if (o.getPaymentStatus() == PaymentStatus.paid && o.getUpdatedAt() != null) {
            paidAt = RuDateFormatter.formatDateTime(o.getUpdatedAt());
        }

        return new OrderResponse(
                o.getId(),
                o.getStatus().name(),
                o.getStatus().getLabel(),
                o.getContractType(),
                o.getBusinessCompanyId(),
                o.getServiceName(),
                o.getServiceId(),
                o.getContactPerson(),
                o.getPhone(),
                o.getCity(),
                o.getObjectAddress(),
                o.getComment(),
                o.getUrgency(),
                clientInfo,
                contractInfo,
                o.getManager() != null ? o.getManager().getName() : null,
                o.getAccountant() != null ? o.getAccountant().getName() : null,
                o.getEcologist() != null ? o.getEcologist().getName() : null,
                o.getLaboratoryUser() != null ? o.getLaboratoryUser().getName() : null,
                o.getEcologyStatus(),
                o.getLaboratoryStatus(),
                o.getContractStatus(),
                o.getPaymentStatus(),
                o.getPaymentAmount(),
                o.getPaymentMethod(),
                o.getSignatureProvider(),
                RuDateFormatter.formatDateTime(o.getSignedAt()),
                paidAt,
                o.getCrmContractStatus(),
                o.getDeadline() != null ? o.getDeadline().toString() : null,
                RuDateFormatter.formatDateTime(o.getCompletedAt()),
                RuDateFormatter.formatDateTime(o.getCancelledAt()),
                quarters,
                docs,
                agreementDocs,
                resultDocs,
                primaryDocumentResponses,
                comments,
                history,
                RuDateFormatter.formatDateTime(o.getCreatedAt()),
                RuDateFormatter.formatDateTime(o.getUpdatedAt())
        );
    }
}
