package kz.ecoprogress.documentflow.signing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

@Entity
@Table(name = "document_flow_signing_routes")
public class SigningRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "route_type", nullable = false, length = 20)
    private SigningRouteType routeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SigningRouteStatus status = SigningRouteStatus.DRAFT;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** Snapshot of whether EXTERNAL_SIGNING was actually entitled at send-for-signing time - see
     *  the "snapshot at send time" note in SigningApiController / public signing API: an external
     *  signer's token-based sign() call must not re-check the sending org's *current* live
     *  entitlements (which may have changed after send), only that the feature was valid when the
     *  route was activated. */
    @Column(name = "external_signing_snapshot", nullable = false)
    private boolean externalSigningSnapshot;

    /** Null = the SIGNATURES_CREATED usage quota has not been reserved for this route yet;
     *  non-null = exactly this many units were reserved at prepare-for-signing time (module spec
     *  §19 reservation model). Set back to null once released (cancelSigning/reject on an
     *  incomplete route) so a route's reservation is never released twice, and so re-preparing an
     *  already-reserved DRAFT route doesn't reserve a second time. */
    @Column(name = "reserved_signature_count")
    private Integer reservedSignatureCount;

    // No initializer: a non-null default on a boxed @Version field breaks Spring Data JPA's
    // isNew() heuristic (it looks null-vs-non-null, not "is this actually persisted"), causing
    // merge() instead of persist() on first save and silently discarding the generated id - see
    // the identical kz.eco.protocol.Protocol#version bug this mirrors.
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public SigningRouteType getRouteType() { return routeType; }
    public void setRouteType(SigningRouteType routeType) { this.routeType = routeType; }
    public SigningRouteStatus getStatus() { return status; }
    public void setStatus(SigningRouteStatus status) { this.status = status; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getActivatedAt() { return activatedAt; }
    public void setActivatedAt(Instant activatedAt) { this.activatedAt = activatedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public boolean isExternalSigningSnapshot() { return externalSigningSnapshot; }
    public void setExternalSigningSnapshot(boolean externalSigningSnapshot) { this.externalSigningSnapshot = externalSigningSnapshot; }
    public Integer getReservedSignatureCount() { return reservedSignatureCount; }
    public void setReservedSignatureCount(Integer reservedSignatureCount) { this.reservedSignatureCount = reservedSignatureCount; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
