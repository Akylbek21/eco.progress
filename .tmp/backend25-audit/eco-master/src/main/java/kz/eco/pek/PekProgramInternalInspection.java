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

/** The company's own scheduled/completed internal PEK inspection (distinct from an external
 *  regulator check) - Правила №250's "внутренний контроль" requirement (module fix item 4). */
@Entity
@Table(name = "pek_program_internal_inspections")
public class PekProgramInternalInspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(name = "planned_date")
    private LocalDate plannedDate;

    @Column(name = "actual_date")
    private LocalDate actualDate;

    @Column(name = "inspection_type", length = 120)
    private String inspectionType;

    /** Which department/unit of the organisation this inspection covers (module fix task 6) -
     *  distinct from inspectionType (what kind of check) and responsibleUserId (who performs it). */
    @Column(length = 255)
    private String department;

    /** How often this inspection recurs - module fix task 6: "plannedDate не должна заменять
     *  обязательную периодичность". plannedDate/actualDate describe ONE occurrence; this describes
     *  the recurring schedule the occurrence belongs to. Reuses {@link PekFrequencyType} for
     *  consistency with {@link PekProgramControlItem#getFrequencyType()}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "frequency_type", length = 20)
    private PekFrequencyType frequencyType;

    @Column(length = 2000)
    private String findings;

    /** Structured violation record for this inspection (module fix task 6) - findings stays as the
     *  free-text summary it always was; violations is specifically what was found non-compliant. */
    @Column(columnDefinition = "TEXT")
    private String violations;

    /** Structured corrective-action record (module fix task 6) - correctiveActionRequired stays
     *  the existing yes/no flag; this is what was actually planned/done about it. */
    @Column(name = "corrective_actions", columnDefinition = "TEXT")
    private String correctiveActions;

    @Column(name = "corrective_action_required", nullable = false)
    private boolean correctiveActionRequired = false;

    @Column(name = "responsible_user_id")
    private Long responsibleUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekInspectionStatus status = PekInspectionStatus.PLANNED;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }
    public LocalDate getPlannedDate() { return plannedDate; }
    public void setPlannedDate(LocalDate plannedDate) { this.plannedDate = plannedDate; }
    public LocalDate getActualDate() { return actualDate; }
    public void setActualDate(LocalDate actualDate) { this.actualDate = actualDate; }
    public String getInspectionType() { return inspectionType; }
    public void setInspectionType(String inspectionType) { this.inspectionType = inspectionType; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public PekFrequencyType getFrequencyType() { return frequencyType; }
    public void setFrequencyType(PekFrequencyType frequencyType) { this.frequencyType = frequencyType; }
    public String getFindings() { return findings; }
    public void setFindings(String findings) { this.findings = findings; }
    public String getViolations() { return violations; }
    public void setViolations(String violations) { this.violations = violations; }
    public String getCorrectiveActions() { return correctiveActions; }
    public void setCorrectiveActions(String correctiveActions) { this.correctiveActions = correctiveActions; }
    public boolean isCorrectiveActionRequired() { return correctiveActionRequired; }
    public void setCorrectiveActionRequired(boolean correctiveActionRequired) { this.correctiveActionRequired = correctiveActionRequired; }
    public Long getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(Long responsibleUserId) { this.responsibleUserId = responsibleUserId; }
    public PekInspectionStatus getStatus() { return status; }
    public void setStatus(PekInspectionStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
