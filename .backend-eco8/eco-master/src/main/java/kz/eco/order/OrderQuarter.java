package kz.eco.order;

import jakarta.persistence.*;
import kz.eco.user.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "order_quarters", uniqueConstraints = @UniqueConstraint(columnNames = {"order_id", "quarter"}),
       indexes = @Index(name = "idx_oq_order_quarter", columnList = "order_id, quarter"))
public class OrderQuarter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    private Long contractId;

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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private WorkStatus workStatus = WorkStatus.planned;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus paymentStatus = PaymentStatus.unpaid;

    @Column(nullable = false)
    private BigDecimal plannedAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal remainingAmount = BigDecimal.ZERO;

    @Column(length = 80)
    private String invoiceNumber;

    private LocalDate invoiceDate;
    private LocalDate dueDate;
    private LocalDate lastPaymentDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_employee_id")
    private User responsibleEmployee;

    @Column(length = 200)
    private String responsibleEmployeeName;

    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "orderQuarter", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<QuarterDocument> quarterDocuments = new ArrayList<>();

    @OneToMany(mappedBy = "orderQuarter", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<QuarterResult> quarterResults = new ArrayList<>();

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
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long contractId) { this.contractId = contractId; }
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
    public WorkStatus getWorkStatus() { return workStatus; }
    public void setWorkStatus(WorkStatus workStatus) { this.workStatus = workStatus; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public BigDecimal getPlannedAmount() { return plannedAmount; }
    public void setPlannedAmount(BigDecimal plannedAmount) { this.plannedAmount = plannedAmount; }
    public BigDecimal getPaidAmount() { return paidAmount; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }
    public LocalDate getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(LocalDate invoiceDate) { this.invoiceDate = invoiceDate; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public LocalDate getLastPaymentDate() { return lastPaymentDate; }
    public void setLastPaymentDate(LocalDate lastPaymentDate) { this.lastPaymentDate = lastPaymentDate; }
    public User getResponsibleEmployee() { return responsibleEmployee; }
    public void setResponsibleEmployee(User responsibleEmployee) { this.responsibleEmployee = responsibleEmployee; }
    public String getResponsibleEmployeeName() { return responsibleEmployeeName; }
    public void setResponsibleEmployeeName(String responsibleEmployeeName) { this.responsibleEmployeeName = responsibleEmployeeName; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<QuarterDocument> getQuarterDocuments() { return quarterDocuments; }
    public List<QuarterResult> getQuarterResults() { return quarterResults; }
}
