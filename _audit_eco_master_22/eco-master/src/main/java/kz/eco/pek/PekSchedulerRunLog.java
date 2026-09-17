package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * One row per scheduler pass (Iteration 4). "triggeredBy" is either the literal string
 * {@code "SCHEDULED"} for a cron-driven run or a user id (as a string) for an admin's manual
 * re-run - kept as a plain string rather than a nullable FK column so both cases fit one field
 * without a nullable-vs-not ambiguity.
 */
@Entity
@Table(name = "pek_scheduler_run_logs")
public class PekSchedulerRunLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_name", nullable = false, length = 60)
    private String jobName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PekSchedulerRunStatus status;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "processed_count", nullable = false)
    private int processedCount;

    @Column(name = "error_count", nullable = false)
    private int errorCount;

    /** Short, non-PII message only - e.g. "3 reports failed collect()", never a stack trace or raw
     *  exception message that might leak entity data. */
    @Column(name = "error_summary", length = 500)
    private String errorSummary;

    @Column(name = "triggered_by", nullable = false, length = 30)
    private String triggeredBy;

    public Long getId() { return id; }
    public String getJobName() { return jobName; }
    public void setJobName(String jobName) { this.jobName = jobName; }
    public PekSchedulerRunStatus getStatus() { return status; }
    public void setStatus(PekSchedulerRunStatus status) { this.status = status; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getFinishedAt() { return finishedAt; }
    public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }
    public int getProcessedCount() { return processedCount; }
    public void setProcessedCount(int processedCount) { this.processedCount = processedCount; }
    public int getErrorCount() { return errorCount; }
    public void setErrorCount(int errorCount) { this.errorCount = errorCount; }
    public String getErrorSummary() { return errorSummary; }
    public void setErrorSummary(String errorSummary) { this.errorSummary = errorSummary; }
    public String getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }
}
