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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One genuinely-over-limit measurement (module spec §14) - always tied to exactly one
 * ProtocolResult (uk_pek_exceedance on (report_id, protocol_result_id): the same result can never
 * produce two exceedance rows for the same report). Created OPEN by {@link PekPlanFactService};
 * only ever resolved by a human action, never auto-resolved by a later recompute - a recompute that
 * no longer finds this measurement exceeding (value corrected, normative changed, result excluded)
 * deletes the row instead of quietly leaving a stale "resolved" one behind.
 *
 * <p>Iteration 2 of the PEK module overhaul adds the corrective-action workflow fields
 * (responsibleUserId/correctiveAction/dueDate/completedAt/completedBy/resolutionComment) on top of
 * the original measurement-fact fields - see {@link PekExceedanceService} for the workflow that
 * mutates them and {@link PekExceedanceStatus} for the extended status set.
 */
@Entity
@Table(name = "pek_report_exceedances",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_exceedance", columnNames = {"report_id", "protocol_result_id"}))
public class PekReportExceedance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "plan_fact_row_id", nullable = false)
    private Long planFactRowId;

    @Column(name = "protocol_id", nullable = false)
    private Long protocolId;

    @Column(name = "protocol_result_id", nullable = false)
    private Long protocolResultId;

    @Column(name = "program_indicator_id", nullable = false)
    private Long programIndicatorId;

    @Column(name = "actual_value", nullable = false, precision = 18, scale = 6)
    private BigDecimal actualValue;

    @Column(name = "normative_value", nullable = false, precision = 18, scale = 6)
    private BigDecimal normativeValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "comparison_type", nullable = false, length = 20)
    private ComparisonType comparisonType;

    @Column(name = "exceedance_ratio", nullable = false, precision = 10, scale = 4)
    private BigDecimal exceedanceRatio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekExceedanceSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekExceedanceStatus status = PekExceedanceStatus.OPEN;

    @Column(length = 1000)
    private String comment;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(length = 1000)
    private String resolution;

    // --- Iteration 2: corrective-action workflow ------------------------------------------------

    @Column(name = "responsible_user_id")
    private Long responsibleUserId;

    @Column(name = "corrective_action", length = 2000)
    private String correctiveAction;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "completed_by")
    private Long completedBy;

    @Column(name = "resolution_comment", length = 2000)
    private String resolutionComment;

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
    public Long getPlanFactRowId() { return planFactRowId; }
    public void setPlanFactRowId(Long planFactRowId) { this.planFactRowId = planFactRowId; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Long getProtocolResultId() { return protocolResultId; }
    public void setProtocolResultId(Long protocolResultId) { this.protocolResultId = protocolResultId; }
    public Long getProgramIndicatorId() { return programIndicatorId; }
    public void setProgramIndicatorId(Long programIndicatorId) { this.programIndicatorId = programIndicatorId; }
    public BigDecimal getActualValue() { return actualValue; }
    public void setActualValue(BigDecimal actualValue) { this.actualValue = actualValue; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public ComparisonType getComparisonType() { return comparisonType; }
    public void setComparisonType(ComparisonType comparisonType) { this.comparisonType = comparisonType; }
    public BigDecimal getExceedanceRatio() { return exceedanceRatio; }
    public void setExceedanceRatio(BigDecimal exceedanceRatio) { this.exceedanceRatio = exceedanceRatio; }
    public PekExceedanceSeverity getSeverity() { return severity; }
    public void setSeverity(PekExceedanceSeverity severity) { this.severity = severity; }
    public PekExceedanceStatus getStatus() { return status; }
    public void setStatus(PekExceedanceStatus status) { this.status = status; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
    public Long getResolvedBy() { return resolvedBy; }
    public void setResolvedBy(Long resolvedBy) { this.resolvedBy = resolvedBy; }
    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public Long getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(Long responsibleUserId) { this.responsibleUserId = responsibleUserId; }
    public String getCorrectiveAction() { return correctiveAction; }
    public void setCorrectiveAction(String correctiveAction) { this.correctiveAction = correctiveAction; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public Long getCompletedBy() { return completedBy; }
    public void setCompletedBy(Long completedBy) { this.completedBy = completedBy; }
    public String getResolutionComment() { return resolutionComment; }
    public void setResolutionComment(String resolutionComment) { this.resolutionComment = resolutionComment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
