package kz.eco.contract;

import jakarta.persistence.*;
import kz.eco.order.PaymentStatus;
import kz.eco.order.WorkStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "contract_quarters", uniqueConstraints = @UniqueConstraint(columnNames = {"contract_id", "quarter"}),
       indexes = @Index(name = "idx_cq_contract_quarter", columnList = "contract_id, quarter"))
public class ContractQuarter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contract_id", nullable = false)
    private Contract contract;

    @Column(length = 32)
    private String orderId;

    @Column(nullable = false)
    private int quarter;

    @Column(nullable = false, length = 20)
    private String quarterLabel;

    @Column(nullable = false)
    private LocalDate periodStart;

    @Column(nullable = false)
    private LocalDate periodEnd;

    @Column(nullable = false, length = 200)
    private String serviceName;

    @Column(nullable = false, length = 80)
    private String workStage;

    @Column(nullable = false)
    private BigDecimal plannedAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal remainingAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus paymentStatus = PaymentStatus.unpaid;

    @Column(length = 80)
    private String invoiceNumber;

    private LocalDate invoiceDate;
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private WorkStatus workStatus = WorkStatus.planned;

    @Column(length = 2000)
    private String comment;

    private LocalDate lastPaymentDate;
    private LocalDateTime completedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public void recalcPaymentStatus() {
        if (paidAmount.compareTo(plannedAmount) >= 0 && plannedAmount.compareTo(BigDecimal.ZERO) > 0) {
            this.paymentStatus = PaymentStatus.paid;
        } else if (dueDate != null && LocalDate.now().isAfter(dueDate) && remainingAmount.compareTo(BigDecimal.ZERO) > 0) {
            this.paymentStatus = PaymentStatus.overdue;
        } else if (paidAmount.compareTo(BigDecimal.ZERO) > 0) {
            this.paymentStatus = PaymentStatus.partial;
        } else {
            this.paymentStatus = PaymentStatus.unpaid;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Contract getContract() { return contract; }
    public void setContract(Contract contract) { this.contract = contract; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public int getQuarter() { return quarter; }
    public void setQuarter(int quarter) { this.quarter = quarter; }
    public String getQuarterLabel() { return quarterLabel; }
    public void setQuarterLabel(String quarterLabel) { this.quarterLabel = quarterLabel; }
    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getWorkStage() { return workStage; }
    public void setWorkStage(String workStage) { this.workStage = workStage; }
    public BigDecimal getPlannedAmount() { return plannedAmount; }
    public void setPlannedAmount(BigDecimal plannedAmount) { this.plannedAmount = plannedAmount; }
    public BigDecimal getPaidAmount() { return paidAmount; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public LocalDate getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(LocalDate invoiceDate) { this.invoiceDate = invoiceDate; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public WorkStatus getWorkStatus() { return workStatus; }
    public void setWorkStatus(WorkStatus workStatus) { this.workStatus = workStatus; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDate getLastPaymentDate() { return lastPaymentDate; }
    public void setLastPaymentDate(LocalDate lastPaymentDate) { this.lastPaymentDate = lastPaymentDate; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
