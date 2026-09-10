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
import kz.eco.protocol.ComparisonType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One row per (report, program indicator) - the computed plan/fact position (module spec §2.6/§6).
 * Recomputed in place by {@link PekPlanFactService} on every collect()/recalculation, never
 * deleted-and-reinserted: the unique constraint on (report_id, program_indicator_id) is both the
 * dedup guarantee and the identity this row keeps stable across recomputes, exactly like
 * PekProgramService's control-item reconciliation (module spec §4's lesson applied here too).
 */
@Entity
@Table(name = "pek_report_plan_fact_rows",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_plan_fact_row", columnNames = {"report_id", "program_indicator_id"}))
public class PekReportPlanFactRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "control_item_id", nullable = false)
    private Long controlItemId;

    @Column(name = "program_indicator_id", nullable = false)
    private Long programIndicatorId;

    @Column(name = "planned_count", nullable = false)
    private int plannedCount;

    @Column(name = "actual_count", nullable = false)
    private int actualCount;

    @Column(name = "missing_count", nullable = false)
    private int missingCount;

    @Column(name = "completion_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal completionPercent = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PekPlanFactRowStatus status;

    @Column(name = "normative_value", precision = 18, scale = 6)
    private BigDecimal normativeValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "comparison_type", length = 20)
    private ComparisonType comparisonType;

    @Column(name = "best_value", precision = 18, scale = 6)
    private BigDecimal bestValue;

    @Column(name = "worst_value", precision = 18, scale = 6)
    private BigDecimal worstValue;

    @Column(name = "average_value", precision = 18, scale = 6)
    private BigDecimal averageValue;

    @Column(name = "has_exceedance", nullable = false)
    private boolean hasExceedance;

    @Column(name = "exceedance_count", nullable = false)
    private int exceedanceCount;

    /** Documented human override (module spec §2.6) - when set, wins over the computed
     *  {@link #status} for read/UI purposes, but never affects the underlying counts, which stay
     *  the real computed truth. Requires {@link #manualReason}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "manual_status", length = 30)
    private PekPlanFactRowStatus manualStatus;

    @Column(name = "manual_reason", length = 500)
    private String manualReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public Long getControlItemId() { return controlItemId; }
    public void setControlItemId(Long controlItemId) { this.controlItemId = controlItemId; }
    public Long getProgramIndicatorId() { return programIndicatorId; }
    public void setProgramIndicatorId(Long programIndicatorId) { this.programIndicatorId = programIndicatorId; }
    public int getPlannedCount() { return plannedCount; }
    public void setPlannedCount(int plannedCount) { this.plannedCount = plannedCount; }
    public int getActualCount() { return actualCount; }
    public void setActualCount(int actualCount) { this.actualCount = actualCount; }
    public int getMissingCount() { return missingCount; }
    public void setMissingCount(int missingCount) { this.missingCount = missingCount; }
    public BigDecimal getCompletionPercent() { return completionPercent; }
    public void setCompletionPercent(BigDecimal completionPercent) { this.completionPercent = completionPercent; }
    public PekPlanFactRowStatus getStatus() { return status; }
    public void setStatus(PekPlanFactRowStatus status) { this.status = status; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public ComparisonType getComparisonType() { return comparisonType; }
    public void setComparisonType(ComparisonType comparisonType) { this.comparisonType = comparisonType; }
    public BigDecimal getBestValue() { return bestValue; }
    public void setBestValue(BigDecimal bestValue) { this.bestValue = bestValue; }
    public BigDecimal getWorstValue() { return worstValue; }
    public void setWorstValue(BigDecimal worstValue) { this.worstValue = worstValue; }
    public BigDecimal getAverageValue() { return averageValue; }
    public void setAverageValue(BigDecimal averageValue) { this.averageValue = averageValue; }
    public boolean isHasExceedance() { return hasExceedance; }
    public void setHasExceedance(boolean hasExceedance) { this.hasExceedance = hasExceedance; }
    public int getExceedanceCount() { return exceedanceCount; }
    public void setExceedanceCount(int exceedanceCount) { this.exceedanceCount = exceedanceCount; }
    public PekPlanFactRowStatus getManualStatus() { return manualStatus; }
    public void setManualStatus(PekPlanFactRowStatus manualStatus) { this.manualStatus = manualStatus; }
    public String getManualReason() { return manualReason; }
    public void setManualReason(String manualReason) { this.manualReason = manualReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }

    /** Effective status for display - the human override when present, otherwise the computed
     *  one. Never used internally for further calculation, only presentation. */
    public PekPlanFactRowStatus effectiveStatus() {
        return manualStatus != null ? manualStatus : status;
    }
}
