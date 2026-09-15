package kz.eco.protocol.calculation;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "protocol_calculation_runs", indexes = {
        @Index(name = "idx_cr_protocol_id", columnList = "protocolId"),
        @Index(name = "idx_cr_result_id", columnList = "protocolResultId")
})
public class CalculationRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long protocolId;

    @Column(nullable = false)
    private Long protocolResultId;

    private Long methodTemplateId;

    @Column(columnDefinition = "TEXT")
    private String inputJson;

    @Column(columnDefinition = "TEXT")
    private String formulaExpression;

    @Column(precision = 20, scale = 6)
    private BigDecimal calculatedValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal averageValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal uncertaintyValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal finalResult;

    @Column(precision = 20, scale = 6)
    private BigDecimal normativeValue;

    @Column(length = 40)
    private String complianceStatus;

    @Column(length = 40)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String warningsJson;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private Long createdBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Long getProtocolResultId() { return protocolResultId; }
    public void setProtocolResultId(Long protocolResultId) { this.protocolResultId = protocolResultId; }
    public Long getMethodTemplateId() { return methodTemplateId; }
    public void setMethodTemplateId(Long methodTemplateId) { this.methodTemplateId = methodTemplateId; }
    public String getInputJson() { return inputJson; }
    public void setInputJson(String inputJson) { this.inputJson = inputJson; }
    public String getFormulaExpression() { return formulaExpression; }
    public void setFormulaExpression(String formulaExpression) { this.formulaExpression = formulaExpression; }
    public BigDecimal getCalculatedValue() { return calculatedValue; }
    public void setCalculatedValue(BigDecimal calculatedValue) { this.calculatedValue = calculatedValue; }
    public BigDecimal getAverageValue() { return averageValue; }
    public void setAverageValue(BigDecimal averageValue) { this.averageValue = averageValue; }
    public BigDecimal getUncertaintyValue() { return uncertaintyValue; }
    public void setUncertaintyValue(BigDecimal uncertaintyValue) { this.uncertaintyValue = uncertaintyValue; }
    public BigDecimal getFinalResult() { return finalResult; }
    public void setFinalResult(BigDecimal finalResult) { this.finalResult = finalResult; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public String getComplianceStatus() { return complianceStatus; }
    public void setComplianceStatus(String complianceStatus) { this.complianceStatus = complianceStatus; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getWarningsJson() { return warningsJson; }
    public void setWarningsJson(String warningsJson) { this.warningsJson = warningsJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
}
