package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One reporting period for one PEK program. periodStart/periodEnd are always computed
 * server-side from periodType+reportYear+reportQuarter (see PekPeriodType#boundsFor) - never
 * accepted directly from a request.
 */
@Entity
@Table(name = "pek_reports", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pek_report_period",
                columnNames = {"object_id", "program_id", "period_key"})
})
public class PekReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "object_id", nullable = false)
    private Long objectId;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Enumerated(EnumType.STRING)
    @Column(name = "period_type", nullable = false, length = 10)
    private PekPeriodType periodType;

    @Column(name = "report_year", nullable = false)
    private Integer reportYear;

    /** Null for periodType=YEAR. Real uniqueness is enforced via {@link #periodKey}, not this
     *  column directly - MySQL would treat two NULLs here as non-equal in a unique index, so
     *  report_quarter alone can never be part of a correct uniqueness constraint. */
    @Column(name = "report_quarter")
    private Integer reportQuarter;

    /** Always non-null: {@code "<year>-YEAR"} or {@code "<year>-Q<quarter>"} - computed by
     *  {@link #computePeriodKey()}, never accepted from a request. The real uniqueness guard
     *  (see the class-level unique constraint and V52__pek_report_period_key.sql) is on this
     *  column, since report_quarter being nullable makes it unusable for that purpose. */
    @Column(name = "period_key", nullable = false, length = 20)
    private String periodKey;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekReportStatus status = PekReportStatus.DRAFT;

    @Column(name = "responsible_user_id")
    private Long responsibleUserId;

    /** Count of distinct finalized protocols linked by the last collect() run - a coarse
     *  readiness signal, not the full plan/fact percentage the module spec describes (that needs
     *  per-indicator program control items, which this slice doesn't model yet). */
    @Column(name = "linked_protocol_count", nullable = false)
    private int linkedProtocolCount = 0;

    @Column(name = "last_collected_at")
    private LocalDateTime lastCollectedAt;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public Long getObjectId() { return objectId; }
    public void setObjectId(Long objectId) { this.objectId = objectId; }
    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }
    public PekPeriodType getPeriodType() { return periodType; }
    public void setPeriodType(PekPeriodType periodType) { this.periodType = periodType; }
    public Integer getReportYear() { return reportYear; }
    public void setReportYear(Integer reportYear) { this.reportYear = reportYear; }
    public Integer getReportQuarter() { return reportQuarter; }
    public void setReportQuarter(Integer reportQuarter) { this.reportQuarter = reportQuarter; }
    public String getPeriodKey() { return periodKey; }

    /** Must be called (directly or via {@link #computePeriodKey()}) before the first save -
     *  periodKey is NOT NULL and carries the real uniqueness guarantee. */
    public void computePeriodKey() {
        this.periodKey = periodType == PekPeriodType.YEAR
                ? reportYear + "-YEAR"
                : reportYear + "-Q" + reportQuarter;
    }
    public LocalDate getPeriodStart() { return periodStart; }
    public void setPeriodStart(LocalDate periodStart) { this.periodStart = periodStart; }
    public LocalDate getPeriodEnd() { return periodEnd; }
    public void setPeriodEnd(LocalDate periodEnd) { this.periodEnd = periodEnd; }
    public PekReportStatus getStatus() { return status; }
    public void setStatus(PekReportStatus status) { this.status = status; }
    public Long getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(Long responsibleUserId) { this.responsibleUserId = responsibleUserId; }
    public int getLinkedProtocolCount() { return linkedProtocolCount; }
    public void setLinkedProtocolCount(int linkedProtocolCount) { this.linkedProtocolCount = linkedProtocolCount; }
    public LocalDateTime getLastCollectedAt() { return lastCollectedAt; }
    public void setLastCollectedAt(LocalDateTime lastCollectedAt) { this.lastCollectedAt = lastCollectedAt; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
