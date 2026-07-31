package kz.eco.protocol.calculation;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "protocol_method_templates", indexes = {
        @Index(name = "idx_mt_template_code", columnList = "protocolTemplateCode"),
        @Index(name = "idx_mt_pollutant_name", columnList = "pollutantName"),
        @Index(name = "idx_mt_pollutant_code", columnList = "pollutantCode")
})
public class MethodTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 60)
    private String protocolTemplateCode;

    @Column(length = 64)
    private String pollutantCode;

    @Column(length = 200)
    private String pollutantName;

    @Column(length = 300)
    private String methodDocument;

    @Column(length = 40)
    private String measurementUnit;

    @Column(length = 40)
    private String resultUnit;

    @Column(columnDefinition = "TEXT")
    private String formulaExpression;

    @Column(nullable = false)
    private Integer decimalPlaces = 3;

    @Column(length = 20, nullable = false)
    private String roundingMode = "HALF_UP";

    @Column(nullable = false)
    private Boolean active = true;

    @Column(nullable = false)
    private Integer version = 1;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getProtocolTemplateCode() { return protocolTemplateCode; }
    public void setProtocolTemplateCode(String protocolTemplateCode) { this.protocolTemplateCode = protocolTemplateCode; }
    public String getPollutantCode() { return pollutantCode; }
    public void setPollutantCode(String pollutantCode) { this.pollutantCode = pollutantCode; }
    public String getPollutantName() { return pollutantName; }
    public void setPollutantName(String pollutantName) { this.pollutantName = pollutantName; }
    public String getMethodDocument() { return methodDocument; }
    public void setMethodDocument(String methodDocument) { this.methodDocument = methodDocument; }
    public String getMeasurementUnit() { return measurementUnit; }
    public void setMeasurementUnit(String measurementUnit) { this.measurementUnit = measurementUnit; }
    public String getResultUnit() { return resultUnit; }
    public void setResultUnit(String resultUnit) { this.resultUnit = resultUnit; }
    public String getFormulaExpression() { return formulaExpression; }
    public void setFormulaExpression(String formulaExpression) { this.formulaExpression = formulaExpression; }
    public Integer getDecimalPlaces() { return decimalPlaces; }
    public void setDecimalPlaces(Integer decimalPlaces) { this.decimalPlaces = decimalPlaces; }
    public String getRoundingMode() { return roundingMode; }
    public void setRoundingMode(String roundingMode) { this.roundingMode = roundingMode; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
