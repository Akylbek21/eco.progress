package kz.ecoprogress.documentflow.entitlement;

import jakarta.persistence.*;
import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.time.LocalDateTime;

/** Per-organization override of a numeric limit (e.g. a custom documents-per-month cap granted by
 *  an admin), independent of enabling/disabling the feature itself (see OrganizationEntitlement). */
@Entity
@Table(name = "organization_plan_overrides", indexes = {
        @Index(name = "idx_org_plan_overrides_org_feature", columnList = "organization_id, feature_code")
})
public class OrganizationPlanOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature_code", nullable = false, length = 40)
    private FeatureCode featureCode;

    @Column(name = "limit_value")
    private Long limitValue;

    /** See {@link OverrideMetricTag} javadoc - disambiguates STORAGE_BYTES vs ACTIVE_MEMBERS
     *  when featureCode=CUSTOM_LIMITS; null for the other feature codes (1:1 with a metric). */
    @Column(name = "metric", length = 40)
    private String metric;

    @Column(name = "starts_at")
    private LocalDateTime startsAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(length = 1000)
    private String reason;

    @Column(name = "granted_by")
    private Long grantedBy;

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
    public Long getLimitValue() { return limitValue; }
    public void setLimitValue(Long limitValue) { this.limitValue = limitValue; }
    public String getMetric() { return metric; }
    public void setMetric(String metric) { this.metric = metric; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getGrantedBy() { return grantedBy; }
    public void setGrantedBy(Long grantedBy) { this.grantedBy = grantedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
