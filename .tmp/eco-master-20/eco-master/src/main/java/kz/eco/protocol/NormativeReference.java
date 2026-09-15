package kz.eco.protocol;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "normative_references")
public class NormativeReference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String templateCode;

    @Column(length = 120)
    private String objectType;

    @Column(nullable = false, length = 200)
    private String indicatorName;

    @Column(length = 40)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private NormativeType normativeType;

    @Column(precision = 20, scale = 6)
    private BigDecimal normativeValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal minValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal maxValue;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ComparisonType comparisonType;

    @Column(length = 300)
    private String normativeDocument;

    @Column(length = 200)
    private String testingMethodNd;

    @Column(length = 200)
    private String samplingMethodNd;

    private LocalDate activeFrom;
    private LocalDate activeTo;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTemplateCode() { return templateCode; }
    public void setTemplateCode(String templateCode) { this.templateCode = templateCode; }
    public String getObjectType() { return objectType; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String indicatorName) { this.indicatorName = indicatorName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public NormativeType getNormativeType() { return normativeType; }
    public void setNormativeType(NormativeType normativeType) { this.normativeType = normativeType; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public BigDecimal getMinValue() { return minValue; }
    public void setMinValue(BigDecimal minValue) { this.minValue = minValue; }
    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal maxValue) { this.maxValue = maxValue; }
    public ComparisonType getComparisonType() { return comparisonType; }
    public void setComparisonType(ComparisonType comparisonType) { this.comparisonType = comparisonType; }
    public String getNormativeDocument() { return normativeDocument; }
    public void setNormativeDocument(String normativeDocument) { this.normativeDocument = normativeDocument; }
    public String getTestingMethodNd() { return testingMethodNd; }
    public void setTestingMethodNd(String testingMethodNd) { this.testingMethodNd = testingMethodNd; }
    public String getSamplingMethodNd() { return samplingMethodNd; }
    public void setSamplingMethodNd(String samplingMethodNd) { this.samplingMethodNd = samplingMethodNd; }
    public LocalDate getActiveFrom() { return activeFrom; }
    public void setActiveFrom(LocalDate activeFrom) { this.activeFrom = activeFrom; }
    public LocalDate getActiveTo() { return activeTo; }
    public void setActiveTo(LocalDate activeTo) { this.activeTo = activeTo; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
