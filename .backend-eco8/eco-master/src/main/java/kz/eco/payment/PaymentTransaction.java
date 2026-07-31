package kz.eco.payment;

import jakarta.persistence.*;
import kz.eco.user.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_transactions")
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long paymentId;
    private Long contractId;
    private Long contractQuarterId;
    private Long orderQuarterId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false, length = 40)
    private String method;

    @Column(nullable = false)
    private LocalDate paidAt;

    @Column(length = 2000)
    private String comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdByUser;

    @Column(length = 200)
    private String createdByName;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long contractId) { this.contractId = contractId; }
    public Long getContractQuarterId() { return contractQuarterId; }
    public void setContractQuarterId(Long contractQuarterId) { this.contractQuarterId = contractQuarterId; }
    public Long getOrderQuarterId() { return orderQuarterId; }
    public void setOrderQuarterId(Long orderQuarterId) { this.orderQuarterId = orderQuarterId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public LocalDate getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDate paidAt) { this.paidAt = paidAt; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public User getCreatedByUser() { return createdByUser; }
    public void setCreatedByUser(User createdByUser) { this.createdByUser = createdByUser; }
    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
