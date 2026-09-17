package kz.ecoprogress.documentflow.subscription;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Append-only audit trail of every subscription state transition. Never updated or deleted. */
@Entity
@Table(name = "document_flow_subscription_events", indexes = {
        @Index(name = "idx_df_sub_events_subscription", columnList = "subscription_id"),
        @Index(name = "idx_df_sub_events_org", columnList = "organization_id")
})
public class SubscriptionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "subscription_id", nullable = false)
    private Long subscriptionId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private SubscriptionEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "old_status", length = 20)
    private SubscriptionStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", length = 20)
    private SubscriptionStatus newStatus;

    @Column(length = 1000)
    private String reason;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(name = "metadata_json", length = 2000)
    private String metadataJson;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getSubscriptionId() { return subscriptionId; }
    public void setSubscriptionId(Long subscriptionId) { this.subscriptionId = subscriptionId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public SubscriptionEventType getEventType() { return eventType; }
    public void setEventType(SubscriptionEventType eventType) { this.eventType = eventType; }
    public SubscriptionStatus getOldStatus() { return oldStatus; }
    public void setOldStatus(SubscriptionStatus oldStatus) { this.oldStatus = oldStatus; }
    public SubscriptionStatus getNewStatus() { return newStatus; }
    public void setNewStatus(SubscriptionStatus newStatus) { this.newStatus = newStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getActorUserId() { return actorUserId; }
    public void setActorUserId(Long actorUserId) { this.actorUserId = actorUserId; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
