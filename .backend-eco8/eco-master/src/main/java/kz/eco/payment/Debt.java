package kz.eco.payment;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "debts", indexes = {
    @Index(name = "idx_debt_status", columnList = "status"),
    @Index(name = "idx_debt_contract_cq", columnList = "contractId, contractQuarterId")
})
public class Debt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 32)
    private String orderId;

    private Long contractId;
    private Long contractQuarterId;
    private Long orderQuarterId;

    @Column(length = 80)
    private String invoiceNumber;

    @Column(length = 20)
    private String quarterLabel;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal remainingAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DebtStatus status = DebtStatus.active;

    @Column(nullable = false, length = 60)
    private String reason;

    private LocalDate dueDate;

    @Column(length = 2000)
    private String comment;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    private LocalDateTime closedAt;

    @Column(length = 200)
    private String clientEmail;

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long contractId) { this.contractId = contractId; }
    public Long getContractQuarterId() { return contractQuarterId; }
    public void setContractQuarterId(Long contractQuarterId) { this.contractQuarterId = contractQuarterId; }
    public Long getOrderQuarterId() { return orderQuarterId; }
    public void setOrderQuarterId(Long orderQuarterId) { this.orderQuarterId = orderQuarterId; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public String getQuarterLabel() { return quarterLabel; }
    public void setQuarterLabel(String quarterLabel) { this.quarterLabel = quarterLabel; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getPaidAmount() { return paidAmount; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public DebtStatus getStatus() { return status; }
    public void setStatus(DebtStatus status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public String getClientEmail() { return clientEmail; }
    public void setClientEmail(String clientEmail) { this.clientEmail = clientEmail; }
}
