package kz.eco.pek;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "pek_program_monitoring", uniqueConstraints =
        @UniqueConstraint(name = "uk_pek_program_monitoring_type", columnNames = {"program_id", "monitoring_type"}))
public class PekProgramMonitoring {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="program_id", nullable=false) private Long programId;
    @Enumerated(EnumType.STRING) @Column(name="monitoring_type", nullable=false, length=30) private PekMonitoringType monitoringType;
    @Column(length=255) private String name;
    @Column(name="methodology", length=1000) private String methodology;
    @Column(name="laboratory_id") private Long laboratoryId;
    @Enumerated(EnumType.STRING) @Column(name="frequency_type", length=20) private PekFrequencyType frequencyType;
    @Column(name="planned_count") private Integer plannedCount;
    @Column(nullable=false) private boolean active = true;
    @ElementCollection
    @CollectionTable(name="pek_monitoring_control_items", joinColumns=@JoinColumn(name="monitoring_id"))
    @Column(name="control_item_id", nullable=false)
    private Set<Long> controlItemIds = new LinkedHashSet<>();
    @Column(name="created_at", nullable=false) private LocalDateTime createdAt = LocalDateTime.now();
    @Column(name="updated_at", nullable=false) private LocalDateTime updatedAt = LocalDateTime.now();
    @Version @Column(nullable=false) private Long version;
    public Long getId(){return id;} public Long getProgramId(){return programId;} public void setProgramId(Long v){programId=v;}
    public PekMonitoringType getMonitoringType(){return monitoringType;} public void setMonitoringType(PekMonitoringType v){monitoringType=v;}
    public String getName(){return name;} public void setName(String v){name=v;} public String getMethodology(){return methodology;} public void setMethodology(String v){methodology=v;}
    public Long getLaboratoryId(){return laboratoryId;} public void setLaboratoryId(Long v){laboratoryId=v;} public PekFrequencyType getFrequencyType(){return frequencyType;} public void setFrequencyType(PekFrequencyType v){frequencyType=v;}
    public Integer getPlannedCount(){return plannedCount;} public void setPlannedCount(Integer v){plannedCount=v;} public boolean isActive(){return active;} public void setActive(boolean v){active=v;}
    public Set<Long> getControlItemIds(){return controlItemIds;} public void setControlItemIds(Set<Long> v){controlItemIds=v==null?new LinkedHashSet<>():new LinkedHashSet<>(v);}
    public LocalDateTime getCreatedAt(){return createdAt;} public LocalDateTime getUpdatedAt(){return updatedAt;} public void setUpdatedAt(LocalDateTime v){updatedAt=v;} public Long getVersion(){return version;}
}
