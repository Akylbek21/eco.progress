package kz.ecoprogress.documentflow.plan;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * One row per (plan, featureCode). {@code limitValue} carries the plan's numeric limit for the
 * usage metric naturally associated with this feature (see kz.ecoprogress.documentflow.usage.
 * UsageLimitService for the FeatureCode -> UsageMetric mapping); {@code null} means "unlimited".
 * The {@code CUSTOM_LIMITS} row's {@code metadataJson} additionally carries the plan's baseline
 * {@code activeMembers}/{@code storageBytes} limits as {"activeMembers":N,"storageBytes":N} - see
 * UsageLimitService javadoc for why those two metrics don't get their own FeatureCode.
 */
@Entity
@Table(name = "plan_features", uniqueConstraints = @UniqueConstraint(name = "uk_plan_features_plan_feature", columnNames = {"plan_id", "feature_code"}))
public class PlanFeature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Enumerated(EnumType.STRING)
    @Column(name = "feature_code", nullable = false, length = 40)
    private FeatureCode featureCode;

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(name = "limit_value")
    private Long limitValue;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPlanId() { return planId; }
    public void setPlanId(Long planId) { this.planId = planId; }
    public FeatureCode getFeatureCode() { return featureCode; }
    public void setFeatureCode(FeatureCode featureCode) { this.featureCode = featureCode; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Long getLimitValue() { return limitValue; }
    public void setLimitValue(Long limitValue) { this.limitValue = limitValue; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
