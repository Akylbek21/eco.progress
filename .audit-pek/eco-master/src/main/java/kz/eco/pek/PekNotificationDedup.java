package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/** Tracks the last time a scheduler-sent notification was created for a given
 *  (entityType, entityId, notifyType) triple, so a re-run for a still-unresolved condition (open
 *  exceedance, still-missing protocols, approaching due date, ...) does not resend the same
 *  notification on every pass - see {@link PekCollectionScheduler#shouldNotify}. */
@Entity
@Table(name = "pek_notification_dedup", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pek_notification_dedup",
                columnNames = {"entity_type", "entity_id", "notify_type"})
})
public class PekNotificationDedup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "notify_type", nullable = false, length = 40)
    private String notifyType;

    @Column(name = "last_notified_at", nullable = false)
    private LocalDateTime lastNotifiedAt;

    public Long getId() { return id; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public String getNotifyType() { return notifyType; }
    public void setNotifyType(String notifyType) { this.notifyType = notifyType; }
    public LocalDateTime getLastNotifiedAt() { return lastNotifiedAt; }
    public void setLastNotifiedAt(LocalDateTime lastNotifiedAt) { this.lastNotifiedAt = lastNotifiedAt; }
}
