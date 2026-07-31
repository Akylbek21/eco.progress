package kz.ecoprogress.documentflow.infrastructure;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Generic idempotency tracking row, reusable by any create-once endpoint in this module (admin
 * access-grants, and whatever create-once endpoints Agents B/C add) - one row per
 * (scope, idempotencyKey) pair, where {@code scope} namespaces the feature (e.g.
 * "document-flow-access-grant", "document-flow-document-create") so two different endpoints can't
 * collide on the same client-chosen key. Modeled after kz.eco.protocol.idempotency.
 * ProtocolIdempotencyRequest - see {@link DocumentFlowIdempotencyService} for the state machine.
 */
@Entity
@Table(name = "document_flow_idempotency_requests",
        uniqueConstraints = @UniqueConstraint(name = "uk_df_idempotency_scope_key", columnNames = {"scope", "idempotency_key"}))
public class DocumentFlowIdempotencyRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String scope;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    /** Generic result identifier (e.g. the created subscription/grant id) - null while PROCESSING. */
    @Column(name = "result_id")
    private Long resultId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocumentFlowIdempotencyStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public String getRequestHash() { return requestHash; }
    public void setRequestHash(String requestHash) { this.requestHash = requestHash; }
    public Long getResultId() { return resultId; }
    public void setResultId(Long resultId) { this.resultId = resultId; }
    public DocumentFlowIdempotencyStatus getStatus() { return status; }
    public void setStatus(DocumentFlowIdempotencyStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
