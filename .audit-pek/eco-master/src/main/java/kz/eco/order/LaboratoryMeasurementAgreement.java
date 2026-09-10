package kz.eco.order;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "laboratory_measurement_agreements", indexes =
    @Index(name = "idx_lma_order", columnList = "order_id")
)
public class LaboratoryMeasurementAgreement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @Column(length = 30)
    private String date;

    @Column(length = 20)
    private String time;

    @Column(length = 500)
    private String address;

    @Column(length = 300)
    private String company;

    @Column(length = 300)
    private String contact;

    @Column(length = 2000)
    private String scope;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MeasurementAgreementStatus status = MeasurementAgreementStatus.draft;

    @Column(length = 2000)
    private String staffComment;

    @Column(length = 2000)
    private String clientComment;

    @Column(length = 30)
    private String rescheduleDate;

    @Column(length = 20)
    private String rescheduleTime;

    @Column(length = 500)
    private String rescheduleAddress;

    @Column(length = 2000)
    private String rescheduleComment;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime sentAt;
    private LocalDateTime respondedAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public MeasurementAgreementStatus getStatus() { return status; }
    public void setStatus(MeasurementAgreementStatus status) { this.status = status; }
    public String getStaffComment() { return staffComment; }
    public void setStaffComment(String staffComment) { this.staffComment = staffComment; }
    public String getClientComment() { return clientComment; }
    public void setClientComment(String clientComment) { this.clientComment = clientComment; }
    public String getRescheduleDate() { return rescheduleDate; }
    public void setRescheduleDate(String rescheduleDate) { this.rescheduleDate = rescheduleDate; }
    public String getRescheduleTime() { return rescheduleTime; }
    public void setRescheduleTime(String rescheduleTime) { this.rescheduleTime = rescheduleTime; }
    public String getRescheduleAddress() { return rescheduleAddress; }
    public void setRescheduleAddress(String rescheduleAddress) { this.rescheduleAddress = rescheduleAddress; }
    public String getRescheduleComment() { return rescheduleComment; }
    public void setRescheduleComment(String rescheduleComment) { this.rescheduleComment = rescheduleComment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
    public LocalDateTime getRespondedAt() { return respondedAt; }
    public void setRespondedAt(LocalDateTime respondedAt) { this.respondedAt = respondedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
