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
 * Item 4 of the PEK settings module fix: admin-editable, per-regulation-version metadata for one
 * of the 9 official table types - mandatory/applicable/displayOrder/periodicity/requiredFields.
 *
 * <p>Deliberately metadata only. Actual per-program table applicability keeps being decided by
 * {@link PekOfficialReportDataService#applicableTableTypes} (driven by the program's declared
 * monitoring directions - well-tested, unchanged), and required-field readiness blocking keeps
 * being enforced by {@link PekOfficialReportDataService#officialReadinessIssues}'s existing
 * per-row checks (item 7 of the module fix: readiness stays the backend source of truth and this
 * config cannot switch a required check off). {@code requiredFields}/{@code displayOrder}/
 * {@code periodicity} here exist for the admin page and any frontend consumer to read - they are
 * descriptive, not enforced by this row alone.
 */
@Entity
@Table(name = "pek_official_table_configs",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_official_table_config",
                columnNames = {"regulation_code", "table_type"}))
public class PekOfficialTableConfigRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "regulation_code", nullable = false, length = 60)
    private String regulationCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "table_type", nullable = false, length = 40)
    private PekOfficialTableType tableType;

    @Column(nullable = false)
    private boolean mandatory = true;

    @Column(nullable = false)
    private boolean applicable = true;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(nullable = false, length = 20)
    private String periodicity = "QUARTERLY";

    @Column(name = "required_fields", length = 1000)
    private String requiredFields;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRegulationCode() { return regulationCode; }
    public void setRegulationCode(String regulationCode) { this.regulationCode = regulationCode; }
    public PekOfficialTableType getTableType() { return tableType; }
    public void setTableType(PekOfficialTableType tableType) { this.tableType = tableType; }
    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
    public boolean isApplicable() { return applicable; }
    public void setApplicable(boolean applicable) { this.applicable = applicable; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
    public String getPeriodicity() { return periodicity; }
    public void setPeriodicity(String periodicity) { this.periodicity = periodicity; }
    public String getRequiredFields() { return requiredFields; }
    public void setRequiredFields(String requiredFields) { this.requiredFields = requiredFields; }
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
