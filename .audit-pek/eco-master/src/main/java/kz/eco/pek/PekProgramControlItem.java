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
 * One position of production environmental control (позиция производственного контроля) within a
 * {@link PekProgram} - module spec §6.2. monitoringPointId/emissionSourceId/waterOutletId/
 * wasteSourceId are plain soft-link identifiers (no dedicated Point/Source entities exist in this
 * codebase, same convention as Protocol.orderId) narrowing which physical point this item covers;
 * at most one is normally populated, matching controlType. Deliberately flat (Long FK fields, no
 * JPA relationships) to match the rest of this module's (and kz.eco.protocol's) persistence style.
 */
@Entity
@Table(name = "pek_program_control_items")
public class PekProgramControlItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "section_code", length = 40)
    private String sectionCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "control_type", nullable = false, length = 30)
    private PekControlType controlType;

    @Column(name = "environment_component", length = 60)
    private String environmentComponent;

    @Column(name = "monitoring_point_id")
    private Long monitoringPointId;

    @Column(name = "emission_source_id")
    private Long emissionSourceId;

    @Column(name = "water_outlet_id")
    private Long waterOutletId;

    @Column(name = "waste_source_id")
    private Long wasteSourceId;

    @Column(name = "laboratory_id")
    private Long laboratoryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "frequency_type", nullable = false, length = 20)
    private PekFrequencyType frequencyType;

    @Column(name = "frequency_value", nullable = false)
    private int frequencyValue = 1;

    @Column(name = "planned_count")
    private Integer plannedCount;

    @Column(name = "measurement_method", length = 255)
    private String measurementMethod;

    @Column(name = "sampling_method", length = 255)
    private String samplingMethod;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "responsible_user_id")
    private Long responsibleUserId;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;

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
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSectionCode() { return sectionCode; }
    public void setSectionCode(String sectionCode) { this.sectionCode = sectionCode; }
    public PekControlType getControlType() { return controlType; }
    public void setControlType(PekControlType controlType) { this.controlType = controlType; }
    public String getEnvironmentComponent() { return environmentComponent; }
    public void setEnvironmentComponent(String environmentComponent) { this.environmentComponent = environmentComponent; }
    public Long getMonitoringPointId() { return monitoringPointId; }
    public void setMonitoringPointId(Long monitoringPointId) { this.monitoringPointId = monitoringPointId; }
    public Long getEmissionSourceId() { return emissionSourceId; }
    public void setEmissionSourceId(Long emissionSourceId) { this.emissionSourceId = emissionSourceId; }
    public Long getWaterOutletId() { return waterOutletId; }
    public void setWaterOutletId(Long waterOutletId) { this.waterOutletId = waterOutletId; }
    public Long getWasteSourceId() { return wasteSourceId; }
    public void setWasteSourceId(Long wasteSourceId) { this.wasteSourceId = wasteSourceId; }
    public Long getLaboratoryId() { return laboratoryId; }
    public void setLaboratoryId(Long laboratoryId) { this.laboratoryId = laboratoryId; }
    public PekFrequencyType getFrequencyType() { return frequencyType; }
    public void setFrequencyType(PekFrequencyType frequencyType) { this.frequencyType = frequencyType; }
    public int getFrequencyValue() { return frequencyValue; }
    public void setFrequencyValue(int frequencyValue) { this.frequencyValue = frequencyValue; }
    public Integer getPlannedCount() { return plannedCount; }
    public void setPlannedCount(Integer plannedCount) { this.plannedCount = plannedCount; }
    public String getMeasurementMethod() { return measurementMethod; }
    public void setMeasurementMethod(String measurementMethod) { this.measurementMethod = measurementMethod; }
    public String getSamplingMethod() { return samplingMethod; }
    public void setSamplingMethod(String samplingMethod) { this.samplingMethod = samplingMethod; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Long getResponsibleUserId() { return responsibleUserId; }
    public void setResponsibleUserId(Long responsibleUserId) { this.responsibleUserId = responsibleUserId; }
    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
