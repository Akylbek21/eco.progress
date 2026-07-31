package kz.ecoprogress.documentflow.usage;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Current-period usage counters for an organization. This foundation layer tracks a single
 * "current" period per organization (periodStart/periodEnd bracketing now) rather than a
 * calendar-month rollover job - Agents B/C and the admin reporting screens read/increment this
 * same row; a periodic "roll to a new period" job is a documented follow-up, out of scope here.
 */
@Entity
@Table(name = "organization_usage", indexes = {
        @Index(name = "idx_org_usage_org_period", columnList = "organization_id, period_start, period_end")
})
public class OrganizationUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "period_start", nullable = false)
    private LocalDateTime periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDateTime periodEnd;

    @Column(name = "documents_created", nullable = false)
    private long documentsCreated = 0;

    @Column(name = "signatures_created", nullable = false)
    private long signaturesCreated = 0;

    @Column(name = "external_signatures_created", nullable = false)
    private long externalSignaturesCreated = 0;

    @Column(name = "storage_bytes", nullable = false)
    private long storageBytes = 0;

    @Column(name = "active_members", nullable = false)
    private long activeMembers = 0;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = LocalDateTime.now();
    }

    public long getValue(UsageMetric metric) {
        return switch (metric) {
            case DOCUMENTS_CREATED -> documentsCreated;
            case SIGNATURES_CREATED -> signaturesCreated;
            case EXTERNAL_SIGNATURES_CREATED -> externalSignaturesCreated;
            case STORAGE_BYTES -> storageBytes;
            case ACTIVE_MEMBERS -> activeMembers;
        };
    }

    public void increment(UsageMetric metric, long amount) {
        switch (metric) {
            case DOCUMENTS_CREATED -> documentsCreated += amount;
            case SIGNATURES_CREATED -> signaturesCreated += amount;
            case EXTERNAL_SIGNATURES_CREATED -> externalSignaturesCreated += amount;
            case STORAGE_BYTES -> storageBytes += amount;
            case ACTIVE_MEMBERS -> activeMembers += amount;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public LocalDateTime getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDateTime periodStart) { this.periodStart = periodStart; }
    public LocalDateTime getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDateTime periodEnd) { this.periodEnd = periodEnd; }
    public long getDocumentsCreated() { return documentsCreated; }
    public void setDocumentsCreated(long documentsCreated) { this.documentsCreated = documentsCreated; }
    public long getSignaturesCreated() { return signaturesCreated; }
    public void setSignaturesCreated(long signaturesCreated) { this.signaturesCreated = signaturesCreated; }
    public long getExternalSignaturesCreated() { return externalSignaturesCreated; }
    public void setExternalSignaturesCreated(long externalSignaturesCreated) { this.externalSignaturesCreated = externalSignaturesCreated; }
    public long getStorageBytes() { return storageBytes; }
    public void setStorageBytes(long storageBytes) { this.storageBytes = storageBytes; }
    public long getActiveMembers() { return activeMembers; }
    public void setActiveMembers(long activeMembers) { this.activeMembers = activeMembers; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
