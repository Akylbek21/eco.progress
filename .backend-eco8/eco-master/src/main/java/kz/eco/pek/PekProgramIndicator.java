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
import kz.eco.protocol.ComparisonType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A required indicator/normative under one {@link PekProgramControlItem} - module spec §6.3.
 * Reuses {@link kz.eco.protocol.ComparisonType} rather than introducing a duplicate enum, since
 * it already covers LE/GE/RANGE/EQUAL/ABSENT/INFO (module spec's LE/LT/EQ/GE/GT/RANGE/INFO map
 * onto it losslessly - LT/GT are represented by the same comparator as LE/GE elsewhere in this
 * codebase's normative-checking code, see kz.eco.protocol.ProtocolNormativeCheckService).
 */
@Entity
@Table(name = "pek_program_indicators")
public class PekProgramIndicator {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(name = "control_item_id", nullable = false)
    private Long controlItemId;

    /** Soft link - no shared Indicator master-data entity exists in this codebase yet. */
    @Column(name = "indicator_id")
    private Long indicatorId;

    @Column(name = "indicator_code", length = 60)
    private String indicatorCode;

    @Column(name = "indicator_name", nullable = false, length = 255)
    private String indicatorName;

    @Column(length = 40)
    private String unit;

    @Column(name = "normative_id")
    private Long normativeId;

    @Column(name = "normative_value", precision = 18, scale = 6)
    private BigDecimal normativeValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "comparison_type", length = 20)
    private ComparisonType comparisonType;

    @Column(name = "min_value", precision = 18, scale = 6)
    private BigDecimal minValue;

    @Column(name = "max_value", precision = 18, scale = 6)
    private BigDecimal maxValue;

    @Column(name = "methodology_id")
    private Long methodologyId;

    @Column(name = "measurement_device_type", length = 120)
    private String measurementDeviceType;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

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
    public Long getControlItemId() { return controlItemId; }
    public void setControlItemId(Long controlItemId) { this.controlItemId = controlItemId; }
    public Long getIndicatorId() { return indicatorId; }
    public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
    public String getIndicatorCode() { return indicatorCode; }
    public void setIndicatorCode(String indicatorCode) { this.indicatorCode = indicatorCode; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String indicatorName) { this.indicatorName = indicatorName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public Long getNormativeId() { return normativeId; }
    public void setNormativeId(Long normativeId) { this.normativeId = normativeId; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public ComparisonType getComparisonType() { return comparisonType; }
    public void setComparisonType(ComparisonType comparisonType) { this.comparisonType = comparisonType; }
    public BigDecimal getMinValue() { return minValue; }
    public void setMinValue(BigDecimal minValue) { this.minValue = minValue; }
    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal maxValue) { this.maxValue = maxValue; }
    public Long getMethodologyId() { return methodologyId; }
    public void setMethodologyId(Long methodologyId) { this.methodologyId = methodologyId; }
    public String getMeasurementDeviceType() { return measurementDeviceType; }
    public void setMeasurementDeviceType(String measurementDeviceType) { this.measurementDeviceType = measurementDeviceType; }
    public boolean isMandatory() { return mandatory; }
    public void setMandatory(boolean mandatory) { this.mandatory = mandatory; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
