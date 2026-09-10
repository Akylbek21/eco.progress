package kz.ecoprogress.documentflow.entitlement;

import jakarta.persistence.*;
import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.time.LocalDateTime;

/**
 * A per-organization override of a single feature's enabled/disabled flag - see
 * EntitlementResolver for the exact priority rule against the plan's own {@code plan_features}
 * row. Time-bounded via startsAt/expiresAt (both nullable = always active once created).
 */
@Entity
@Table(name = "organization_entitlements", indexes = {
        @Index(name = "idx_org_entitlements_org_feature", columnList = "organization_id, feature_code")
})
public class OrganizationEntitlement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature_code", nullable = false, length = 40)
    private FeatureCode featureCode;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntitlementSource source;

    @Column(length = 1000)
    private String reason;

    @Column(name = "granted_by")
    private Long grantedBy;

    @Column(name = "metadata_json", length = 2000)
    private String metadataJson;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /** Whether this row is currently in effect (enabled/disabled override applies right now). */
    public boolean isCurrentlyActive(LocalDateTime now) {
        if (startsAt != null && now.isBefore(startsAt)) return false;
        return expiresAt == null || !now.isAfter(expiresAt);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public FeatureCode getFeatureCode() { return featureCode; }
    public void setFeatureCode(FeatureCode featureCode) { this.featureCode = featureCode; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public EntitlementSource getSource() { return source; }
    public void setSource(EntitlementSource source) { this.source = source; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getGrantedBy() { return grantedBy; }
    public void setGrantedBy(Long grantedBy) { this.grantedBy = grantedBy; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
