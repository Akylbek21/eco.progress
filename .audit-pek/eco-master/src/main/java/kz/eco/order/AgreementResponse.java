package kz.eco.order;

import jakarta.persistence.*;
import kz.eco.user.User;
import java.time.LocalDateTime;

@Entity
@Table(name = "agreement_responses", indexes = {
        @Index(name = "idx_ar_order", columnList = "order_id"),
        @Index(name = "idx_ar_document", columnList = "document_id")
})
public class AgreementResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, length = 20)
    private String orderId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(nullable = false, length = 40)
    private String action;

    @Column(length = 2000)
    private String comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responded_by_user_id")
    private User respondedByUser;

    @Column(nullable = false)
    private LocalDateTime respondedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public User getRespondedByUser() { return respondedByUser; }
    public void setRespondedByUser(User respondedByUser) { this.respondedByUser = respondedByUser; }
    public LocalDateTime getRespondedAt() { return respondedAt; }
    public void setRespondedAt(LocalDateTime respondedAt) { this.respondedAt = respondedAt; }
}
