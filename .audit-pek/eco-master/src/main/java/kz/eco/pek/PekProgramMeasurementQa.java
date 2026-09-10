package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Quality-assurance procedure backing one measured parameter (calibration/verification cadence -
 *  not the measurement result itself, see {@link PekProgramMonitoring}) - Правила №250 requires a
 *  documented QA/QC basis for every measured indicator (module fix item 4). */
@Entity
@Table(name = "pek_program_measurement_qa")
public class PekProgramMeasurementQa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(nullable = false, length = 255)
    private String parameter;

    @Column(name = "qa_procedure", length = 2000)
    private String qaProcedure;

    @Column(length = 120)
    private String frequency;

    @Column(name = "responsible_user_id")
    private Long responsibleUserId;

    @Column(name = "last_check_date")
    private LocalDate lastCheckDate;

    @Column(name = "next_check_date")
    private LocalDate nextCheckDate;

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
    public String getParameter() { return parameter; }
    public void setParameter(String parameter) { this.parameter = parameter; }
    public String getQaProcedure() { return qaProcedure; }
    public void setQaProcedure(String qaProcedure) { this.qaProcedure = qaProcedure; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public Long getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(Long responsibleUserId) { this.responsibleUserId = responsibleUserId; }
    public LocalDate getLastCheckDate() { return lastCheckDate; }
    public void setLastCheckDate(LocalDate lastCheckDate) { this.lastCheckDate = lastCheckDate; }
    public LocalDate getNextCheckDate() { return nextCheckDate; }
    public void setNextCheckDate(LocalDate nextCheckDate) { this.nextCheckDate = nextCheckDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
