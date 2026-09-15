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

import java.time.LocalDateTime;

/**
 * Admin-editable, global submission-deadline rule row - persisted form of
 * {@link PekSubmissionDeadlineRule}. Item 3 of the PEK settings module fix: replaces the hardcoded
 * {@code RULES} table in {@link PekSubmissionDeadlineService}.
 *
 * <p>Deliberately keeps the same calendar-offset shape ({@code monthsAfterPeriodEnd}, snapped to
 * day 1) as the code it replaces rather than a raw day count - see
 * {@link PekSubmissionDeadlineRule}'s javadoc for why a day count is wrong for this rule (drifts
 * with month length). {@code active=false} lets an admin retire a rule without deleting the row
 * (so an already-computed deadline referencing it stays explainable).
 */
@Entity
@Table(name = "pek_submission_deadline_rules",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_deadline_rule_type_regulation",
                columnNames = {"report_type", "regulation_code"}))
public class PekSubmissionDeadlineRuleRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", nullable = false, length = 40)
    private PekReportType reportType;

    @Column(name = "regulation_code", nullable = false, length = 60)
    private String regulationCode;

    @Column(name = "months_after_period_end", nullable = false)
    private int monthsAfterPeriodEnd;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public PekSubmissionDeadlineRule toRecord() {
        return new PekSubmissionDeadlineRule(reportType, regulationCode, monthsAfterPeriodEnd, description);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public PekReportType getReportType() { return reportType; }
    public void setReportType(PekReportType reportType) { this.reportType = reportType; }
    public String getRegulationCode() { return regulationCode; }
    public void setRegulationCode(String regulationCode) { this.regulationCode = regulationCode; }
    public int getMonthsAfterPeriodEnd() { return monthsAfterPeriodEnd; }
    public void setMonthsAfterPeriodEnd(int monthsAfterPeriodEnd) { this.monthsAfterPeriodEnd = monthsAfterPeriodEnd; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
