package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDateTime;

/** One row of the program's responsibility structure - who holds which PEK-relevant role for this
 *  specific program (e.g. "заведующий лабораторией", "инженер-эколог участка"), distinct from the
 *  single responsibleUserId/reviewerUserId/approverUserId workflow-actor columns on
 *  {@link PekProgram} itself, which only cover the review/approval workflow, not the fuller
 *  org-chart-style breakdown Правила №250 expects (module fix item 4). */
@Entity
@Table(name = "pek_program_responsibilities")
public class PekProgramResponsibility {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(name = "role_label", nullable = false, length = 255)
    private String roleLabel;

    @Column(name = "user_id")
    private Long userId;

    @Column(length = 2000)
    private String duties;

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
    public String getRoleLabel() { return roleLabel; }
    public void setRoleLabel(String roleLabel) { this.roleLabel = roleLabel; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getDuties() { return duties; }
    public void setDuties(String duties) { this.duties = duties; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
