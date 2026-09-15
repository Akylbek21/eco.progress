package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Admin-editable, global (not tenant-scoped) regulation edition row - the persisted form of
 * {@link PekRegulationVersion}. Item 1 of the PEK settings module fix: this table is what replaces
 * the hardcoded {@code ENTRIES} list that used to live in {@link PekRegulationVersionService}.
 *
 * <p>Never rewritten in place once a program/report has stamped its {@code code} - see
 * {@link PekRegulationAdminService#delete} (blocked if in use) and item 8 (versioning): publishing
 * a new edition only ever appends a new row and flips {@code status}, it never mutates an existing
 * one's regulatory content (effectiveFrom/baseOrder/templateVersion etc).
 */
@Entity
@Table(name = "pek_regulation_versions")
public class PekRegulationVersionRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String code;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "base_order", nullable = false, length = 500)
    private String baseOrder;

    @Column(name = "revision_order", length = 500)
    private String revisionOrder;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "program_template_version", nullable = false, length = 40)
    private String programTemplateVersion;

    @Column(name = "report_template_version", nullable = false, length = 40)
    private String reportTemplateVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekRegulationVersionStatus status;

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

    public PekRegulationVersion toRecord() {
        return new PekRegulationVersion(code, title, baseOrder, revisionOrder, effectiveFrom, effectiveTo,
                programTemplateVersion, reportTemplateVersion);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBaseOrder() { return baseOrder; }
    public void setBaseOrder(String baseOrder) { this.baseOrder = baseOrder; }
    public String getRevisionOrder() { return revisionOrder; }
    public void setRevisionOrder(String revisionOrder) { this.revisionOrder = revisionOrder; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }
    public String getProgramTemplateVersion() { return programTemplateVersion; }
    public void setProgramTemplateVersion(String programTemplateVersion) { this.programTemplateVersion = programTemplateVersion; }
    public String getReportTemplateVersion() { return reportTemplateVersion; }
    public void setReportTemplateVersion(String reportTemplateVersion) { this.reportTemplateVersion = reportTemplateVersion; }
    public PekRegulationVersionStatus getStatus() { return status; }
    public void setStatus(PekRegulationVersionStatus status) { this.status = status; }
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
