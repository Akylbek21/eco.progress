package kz.eco.contract;

import jakarta.persistence.*;
import kz.eco.client.Client;
import kz.eco.order.CrmContractStatus;
import kz.eco.user.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contracts")
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 32)
    private String orderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @Column(length = 40)
    private String businessCompanyId;

    @Column(nullable = false, unique = true, length = 80)
    private String contractNumber;

    @Column(nullable = false, length = 30)
    private String contractType;

    @Column(nullable = false, length = 20)
    private String status = "draft";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CrmContractStatus crmStatus = CrmContractStatus.not_created;

    private LocalDate startsAt;
    private LocalDate endsAt;

    @Column(nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal remainingAmount = BigDecimal.ZERO;

    @Column(length = 80)
    private String signatureProvider;

    private LocalDateTime signedAt;

    @Column(columnDefinition = "LONGTEXT")
    private String signedCms;

    @Column(length = 500)
    private String signerSubject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsible_manager_id")
    private User responsibleManager;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "contract", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("quarter ASC")
    private List<ContractQuarter> quarters = new ArrayList<>();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public void recalcTotals() {
        BigDecimal paid = BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        for (ContractQuarter q : quarters) {
            total = total.add(q.getPlannedAmount());
            paid = paid.add(q.getPaidAmount());
        }
        this.totalAmount = total;
        this.paidAmount = paid;
        this.remainingAmount = total.subtract(paid).max(BigDecimal.ZERO);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public String getBusinessCompanyId() { return businessCompanyId; }
    public void setBusinessCompanyId(String businessCompanyId) { this.businessCompanyId = businessCompanyId; }
    public String getContractNumber() { return contractNumber; }
    public void setContractNumber(String contractNumber) { this.contractNumber = contractNumber; }
    public String getContractType() { return contractType; }
    public void setContractType(String contractType) { this.contractType = contractType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public CrmContractStatus getCrmStatus() { return crmStatus; }
    public void setCrmStatus(CrmContractStatus crmStatus) { this.crmStatus = crmStatus; }
    public LocalDate getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDate startsAt) { this.startsAt = startsAt; }
    public LocalDate getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDate endsAt) { this.endsAt = endsAt; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public BigDecimal getPaidAmount() { return paidAmount; }
    public void setPaidAmount(BigDecimal paidAmount) { this.paidAmount = paidAmount; }
    public BigDecimal getRemainingAmount() { return remainingAmount; }
    public void setRemainingAmount(BigDecimal remainingAmount) { this.remainingAmount = remainingAmount; }
    public String getSignatureProvider() { return signatureProvider; }
    public void setSignatureProvider(String signatureProvider) { this.signatureProvider = signatureProvider; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
    public String getSignedCms() { return signedCms; }
    public void setSignedCms(String signedCms) { this.signedCms = signedCms; }
    public String getSignerSubject() { return signerSubject; }
    public void setSignerSubject(String signerSubject) { this.signerSubject = signerSubject; }
    public User getResponsibleManager() { return responsibleManager; }
    public void setResponsibleManager(User responsibleManager) { this.responsibleManager = responsibleManager; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<ContractQuarter> getQuarters() { return quarters; }
}
