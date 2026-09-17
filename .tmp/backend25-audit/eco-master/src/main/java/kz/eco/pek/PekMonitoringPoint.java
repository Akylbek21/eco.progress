package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDateTime;

/** A concrete sampling/observation point under one {@link PekProgramMonitoring} direction (module
 *  fix item 4: Правила №250 structure - the direction/type level alone is too coarse). */
@Entity
@Table(name = "pek_monitoring_points")
public class PekMonitoringPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "monitoring_id", nullable = false)
    private Long monitoringId;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 120)
    private String coordinates;

    @Column(length = 2000)
    private String description;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMonitoringId() { return monitoringId; }
    public void setMonitoringId(Long monitoringId) { this.monitoringId = monitoringId; }
    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCoordinates() { return coordinates; }
    public void setCoordinates(String coordinates) { this.coordinates = coordinates; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
