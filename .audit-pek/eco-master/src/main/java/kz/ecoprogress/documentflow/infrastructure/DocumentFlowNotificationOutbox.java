package kz.ecoprogress.documentflow.infrastructure;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * "Send after commit" outbox for subscription/access in-app notifications, modeled after
 * kz.eco.mail.EmailOutbox - a business transaction (e.g. an admin access-grant) enqueues a row
 * here instead of calling kz.eco.notification.NotificationService synchronously, so the
 * notification only actually fires once the enqueuing transaction has committed (via the
 * scheduled {@link DocumentFlowNotificationOutboxProcessor}, not a same-transaction side effect).
 */
@Entity
@Table(name = "document_flow_notification_outbox", indexes = {
        @Index(name = "idx_df_notif_outbox_status", columnList = "status")
})
public class DocumentFlowNotificationOutbox {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(nullable = false, length = 60)
    private String type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentFlowNotificationOutboxStatus status = DocumentFlowNotificationOutboxStatus.PENDING;

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public DocumentFlowNotificationOutboxStatus getStatus() { return status; }
    public void setStatus(DocumentFlowNotificationOutboxStatus status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
}
