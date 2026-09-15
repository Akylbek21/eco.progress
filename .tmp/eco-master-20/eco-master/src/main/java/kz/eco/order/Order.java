package kz.eco.order;

import jakarta.persistence.*;
import kz.eco.client.Client;
import kz.eco.user.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_orders_client_id", columnList = "client_id"),
    @Index(name = "idx_orders_status", columnList = "status"),
    @Index(name = "idx_orders_contract_type", columnList = "contractType"),
    @Index(name = "idx_orders_business_company_id", columnList = "businessCompanyId"),
    @Index(name = "idx_orders_manager_id", columnList = "manager_id"),
    @Index(name = "idx_orders_created_at", columnList = "createdAt")
})
public class Order {

    @Id
    @Column(length = 32)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdByUser;

    @Column(length = 40)
    private String businessCompanyId;

    @Column(length = 80)
    private String serviceId;

    @Column(nullable = false, length = 200)
    private String serviceName;

    @Column(length = 200)
    private String contactPerson;

    @Column(length = 40)
    private String phone;

    @Column(length = 80)
    private String city;

    @Column(length = 500)
    private String objectAddress;

    @Column(length = 2000)
    private String comment;

    @Column(length = 80)
    private String urgency;

    @Convert(converter = OrderStatusConverter.class)
    @Column(nullable = false, length = 40)
    private OrderStatus status = OrderStatus.CONSULTATION;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ContractType contractType = ContractType.one_time;

    private Long contractId;

    private LocalDate annualPeriodStart;
    private LocalDate annualPeriodEnd;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PaymentStatus paymentStatus = PaymentStatus.not_sent;

    private BigDecimal paymentAmount;

    @Column(length = 80)
    private String paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ContractStatus contractStatus = ContractStatus.not_sent;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private CrmContractStatus crmContractStatus = CrmContractStatus.not_created;

    @Column(length = 80)
    private String signatureProvider;

    private LocalDateTime signedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private User manager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accountant_id")
    private User accountant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ecologist_id")
    private User ecologist;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "laboratory_user_id")
    private User laboratoryUser;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private EcologyStatus ecologyStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private LaboratoryStatus laboratoryStatus;

    private LocalDate deadline;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("uploadedAt DESC")
    private List<OrderDocument> documents = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<OrderComment> comments = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<OrderHistory> history = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("quarter ASC")
    private List<OrderQuarter> quarters = new ArrayList<>();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public User getCreatedByUser() { return createdByUser; }
    public void setCreatedByUser(User createdByUser) { this.createdByUser = createdByUser; }
    public String getBusinessCompanyId() { return businessCompanyId; }
    public void setBusinessCompanyId(String businessCompanyId) { this.businessCompanyId = businessCompanyId; }
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getObjectAddress() { return objectAddress; }
    public void setObjectAddress(String objectAddress) { this.objectAddress = objectAddress; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public ContractType getContractType() { return contractType; }
    public void setContractType(ContractType contractType) { this.contractType = contractType; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long contractId) { this.contractId = contractId; }
    public LocalDate getAnnualPeriodStart() { return annualPeriodStart; }
    public void setAnnualPeriodStart(LocalDate annualPeriodStart) { this.annualPeriodStart = annualPeriodStart; }
    public LocalDate getAnnualPeriodEnd() { return annualPeriodEnd; }
    public void setAnnualPeriodEnd(LocalDate annualPeriodEnd) { this.annualPeriodEnd = annualPeriodEnd; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public BigDecimal getPaymentAmount() { return paymentAmount; }
    public void setPaymentAmount(BigDecimal paymentAmount) { this.paymentAmount = paymentAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public ContractStatus getContractStatus() { return contractStatus; }
    public void setContractStatus(ContractStatus contractStatus) { this.contractStatus = contractStatus; }
    public CrmContractStatus getCrmContractStatus() { return crmContractStatus; }
    public void setCrmContractStatus(CrmContractStatus crmContractStatus) { this.crmContractStatus = crmContractStatus; }
    public String getSignatureProvider() { return signatureProvider; }
    public void setSignatureProvider(String signatureProvider) { this.signatureProvider = signatureProvider; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
    public User getManager() { return manager; }
    public void setManager(User manager) { this.manager = manager; }
    public User getAccountant() { return accountant; }
    public void setAccountant(User accountant) { this.accountant = accountant; }
    public User getEcologist() { return ecologist; }
    public void setEcologist(User ecologist) { this.ecologist = ecologist; }
    public User getLaboratoryUser() { return laboratoryUser; }
    public void setLaboratoryUser(User laboratoryUser) { this.laboratoryUser = laboratoryUser; }
    public EcologyStatus getEcologyStatus() { return ecologyStatus; }
    public void setEcologyStatus(EcologyStatus ecologyStatus) { this.ecologyStatus = ecologyStatus; }
    public LaboratoryStatus getLaboratoryStatus() { return laboratoryStatus; }
    public void setLaboratoryStatus(LaboratoryStatus laboratoryStatus) { this.laboratoryStatus = laboratoryStatus; }
    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(LocalDateTime cancelledAt) { this.cancelledAt = cancelledAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<OrderDocument> getDocuments() { return documents; }
    public List<OrderComment> getComments() { return comments; }
    public List<OrderHistory> getHistory() { return history; }
    public List<OrderQuarter> getQuarters() { return quarters; }
}
