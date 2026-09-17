package kz.eco.protocol.idempotency;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/**
 * One row per {@code (userId, idempotencyKey)} pair ever seen by
 * {@code POST /api/protocols/quick-create}. See {@link ProtocolIdempotencyService} for the state
 * machine that reads/writes this entity and V32__protocol_idempotency_requests.sql for the schema.
 *
 * Plain getters/setters, no Lombok - matches kz.eco.protocol.Protocol's style.
 */
@Entity
@Table(name = "protocol_idempotency_requests",
        uniqueConstraints = @UniqueConstraint(name = "uk_protocol_idempotency", columnNames = {"user_id", "idempotency_key"}))
public class ProtocolIdempotencyRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    /** SHA-256 hex digest of the request body - detects the same key being reused for a different
     *  request, which is a client error rather than something to silently return old data for. */
    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    /** Null while status=PROCESSING; set once the quick-create call completes successfully. */
    @Column(name = "protocol_id")
    private Long protocolId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ProtocolIdempotencyStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getRequestHash() { return requestHash; }
    public void setRequestHash(String requestHash) { this.requestHash = requestHash; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public ProtocolIdempotencyStatus getStatus() { return status; }
    public void setStatus(ProtocolIdempotencyStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
