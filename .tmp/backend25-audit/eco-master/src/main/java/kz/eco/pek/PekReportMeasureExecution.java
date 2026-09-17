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

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Фактическое выполнение одного природоохранного мероприятия программы за отчётный период.
 *
 * <p>{@link PekProgramMeasure} describes the plan (what, how much, when, for how much money) and
 * carries a single lifetime completion figure. The quarterly measures report needs what happened
 * in THIS period - money actually spent, the share of the work done, and why it fell short - and
 * those differ per quarter, so they cannot live on the program row without overwriting the
 * previous quarter's figures.
 */
@Entity
@Table(name = "pek_report_measure_executions",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_report_measure_execution",
                columnNames = {"report_id", "measure_id"}))
public class PekReportMeasureExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "measure_id", nullable = false)
    private Long measureId;

    /** Освоено за период, в валюте мероприятия. */
    @Column(name = "actual_amount", precision = 18, scale = 2)
    private BigDecimal actualAmount;

    /** Процент выполнения работ за период (0..100) - independent of how much money was spent. */
    @Column(name = "completion_percent", precision = 5, scale = 2)
    private BigDecimal completionPercent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekMeasureStatus status = PekMeasureStatus.PLANNED;

    @Column(length = 2000)
    private String note;

    /** Причина невыполнения - required once the period's work is below 100%. */
    @Column(name = "non_completion_reason", length = 2000)
    private String nonCompletionReason;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long v) { reportId = v; }
    public Long getMeasureId() { return measureId; }
    public void setMeasureId(Long v) { measureId = v; }
    public BigDecimal getActualAmount() { return actualAmount; }
    public void setActualAmount(BigDecimal v) { actualAmount = v; }
    public BigDecimal getCompletionPercent() { return completionPercent; }
    public void setCompletionPercent(BigDecimal v) { completionPercent = v; }
    public PekMeasureStatus getStatus() { return status; }
    public void setStatus(PekMeasureStatus v) { status = v; }
    public String getNote() { return note; }
    public void setNote(String v) { note = v; }
    public String getNonCompletionReason() { return nonCompletionReason; }
    public void setNonCompletionReason(String v) { nonCompletionReason = v; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long v) { updatedBy = v; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v) { updatedAt = v; }
    public Long getVersion() { return version; }
}
