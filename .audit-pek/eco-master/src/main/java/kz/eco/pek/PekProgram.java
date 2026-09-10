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
 * A PEK (производственный экологический контроль) monitoring program for one real, existing
 * CompanyObject - never a company standing in for its own object (see PekProgramService#create,
 * which validates objectId belongs to companyId exactly like ProtocolService does). This header
 * row holds workflow/identity fields only - monitoring, monitoring points, control items,
 * indicators, measures, documents, internal inspections, measurement QA, emergency procedures and
 * the responsibility structure are all separate related entities (module fix item 4: expansion
 * towards the official Правила №250 program structure), never columns jammed onto this table.
 */
@Entity
@Table(name = "pek_programs")
public class PekProgram {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "object_id", nullable = false)
    private Long objectId;

    @Column(nullable = false, length = 60)
    private String number;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_until", nullable = false)
    private LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekProgramStatus status = PekProgramStatus.DRAFT;

    @Column(name = "responsible_user_id")
    private Long responsibleUserId;

    /** Set when submitted for review (module spec §15); who is expected to return/approve it. */
    @Column(name = "reviewer_user_id")
    private Long reviewerUserId;

    @Column(name = "approver_user_id")
    private Long approverUserId;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    // ---- facility snapshot (item 1 / V109) ---------------------------------------------------
    // Copied from CompanyObject at creation so historical programs are not silently mutated when
    // the live object record changes after program approval.

    @Column(name = "facility_information", columnDefinition = "TEXT")
    private String facilityInformation;

    /** КАТО code (справочник административно-территориальных объектов). */
    @Column(length = 20)
    private String kato;

    /** BIN snapshot - the company's БИН at the time this program was created. Stored separately
     *  from the live Company.bin so that a company BIN change does not alter historical records. */
    @Column(name = "bin_snapshot", length = 12)
    private String binSnapshot;

    /** ОКЭД code for the primary activity. */
    @Column(length = 10)
    private String oked;

    /** Environmental category (I–IV per RK environmental legislation). */
    @Column(name = "environmental_category", length = 60)
    private String environmentalCategory;

    /** Design/installed production capacity of the facility. Free-text with unit (e.g. "120 т/год"). */
    @Column(name = "design_capacity", length = 255)
    private String designCapacity;

    @Column(name = "production_characteristics", columnDefinition = "TEXT")
    private String productionCharacteristics;

    /** Actual (as-operated) production capacity, as opposed to {@link #designCapacity}. Free-text
     *  with unit, e.g. "84 т/год". Added in V114 - the form has always collected it, but there was
     *  no column, no entity field and no DTO field, so it was silently dropped on save. */
    @Column(name = "actual_capacity", length = 255)
    private String actualCapacity;

    /** Free-text description of what the program's monitoring covers (объекты, среды, границы).
     *  Distinct from the structured PekProgramMonitoring rows - this is the narrative scope the
     *  author writes in the program header. Added in V114, see actualCapacity. */
    @Column(name = "monitoring_scope", columnDefinition = "TEXT")
    private String monitoringScope;

    /** Author's notes on readiness/outstanding items for this program. Added in V114, see
     *  actualCapacity. Unrelated to the computed readinessPercent. */
    @Column(name = "readiness_notes", columnDefinition = "TEXT")
    private String readinessNotes;

    // ---- regulation / template stamps --------------------------------------------------------

    /** Which edition of the underlying regulation this program was built against - Правила №250
     *  (module fix item 4). Pre-existing programs get a 'legacy' backfill value (see V104), never
     *  a guess at which exact edition they were actually authored under. */
    @Column(name = "regulation_version", nullable = false, length = 500)
    private String regulationVersion = PekRegulationVersionService.CURRENT;

    /** Code of the regulation edition in {@link PekRegulationVersionService}'s reference book.
     *  Stamped once at creation and kept for life - an amended regulation does not retroactively
     *  change a program approved under the previous edition. Deadline rules and document templates
     *  are keyed on this, not on the free-text {@link #regulationVersion} display string. */
    @Column(name = "regulation_code", nullable = false, length = 40)
    private String regulationCode = PekRegulationVersionService.PEK_RULES_250_2021;

    /** Which structural template version this program's content follows - lets the frontend
     *  distinguish a fully-structured Правила-№250-shaped program from a legacy flat one without
     *  inferring it from field presence. */
    @Column(name = "template_version", nullable = false, length = 40)
    private String templateVersion = "v1-legacy";

    /** Business-visible "how many times has this program's content changed" counter - bumped by
     *  every child-section mutation via {@link PekProgramContentRevisionService#bump}, separate
     *  from the optimistic-locking {@link #version} field (see that service's javadoc for why). */
    @Column(name = "content_revision", nullable = false)
    private long contentRevision = 0;

    public String getFacilityInformation() { return facilityInformation; }
    public void setFacilityInformation(String v) { facilityInformation = v; }
    public String getKato() { return kato; }
    public void setKato(String v) { kato = v; }
    public String getBinSnapshot() { return binSnapshot; }
    public void setBinSnapshot(String v) { binSnapshot = v; }
    public String getOked() { return oked; }
    public void setOked(String v) { oked = v; }
    public String getEnvironmentalCategory() { return environmentalCategory; }
    public void setEnvironmentalCategory(String v) { environmentalCategory = v; }
    public String getDesignCapacity() { return designCapacity; }
    public void setDesignCapacity(String v) { designCapacity = v; }
    public String getProductionCharacteristics() { return productionCharacteristics; }
    public void setProductionCharacteristics(String v) { productionCharacteristics = v; }
    public String getActualCapacity() { return actualCapacity; }
    public void setActualCapacity(String v) { actualCapacity = v; }
    public String getMonitoringScope() { return monitoringScope; }
    public void setMonitoringScope(String v) { monitoringScope = v; }
    public String getReadinessNotes() { return readinessNotes; }
    public void setReadinessNotes(String v) { readinessNotes = v; }

    public String getRegulationCode() { return regulationCode; }
    public void setRegulationCode(String regulationCode) { this.regulationCode = regulationCode; }
    public String getRegulationVersion() { return regulationVersion; }
    public void setRegulationVersion(String regulationVersion) { this.regulationVersion = regulationVersion; }
    public String getTemplateVersion() { return templateVersion; }
    public void setTemplateVersion(String templateVersion) { this.templateVersion = templateVersion; }
    public long getContentRevision() { return contentRevision; }
    public void setContentRevision(long contentRevision) { this.contentRevision = contentRevision; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public Long getObjectId() { return objectId; }
    public void setObjectId(Long objectId) { this.objectId = objectId; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }
    public LocalDate getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDate validUntil) { this.validUntil = validUntil; }
    public PekProgramStatus getStatus() { return status; }
    public void setStatus(PekProgramStatus status) { this.status = status; }
    public Long getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(Long responsibleUserId) { this.responsibleUserId = responsibleUserId; }
    public Long getReviewerUserId() { return reviewerUserId; }
    public void setReviewerUserId(Long reviewerUserId) { this.reviewerUserId = reviewerUserId; }
    public Long getApproverUserId() { return approverUserId; }
    public void setApproverUserId(Long approverUserId) { this.approverUserId = approverUserId; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public LocalDateTime getActivatedAt() { return activatedAt; }
    public void setActivatedAt(LocalDateTime activatedAt) { this.activatedAt = activatedAt; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
