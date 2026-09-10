package kz.eco.protocol.calculation;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "protocol_method_variables")
public class MethodVariable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "method_template_id", nullable = false)
    private Long methodTemplateId;

    @Column(nullable = false, length = 60)
    private String variableKey;

    @Column(nullable = false, length = 200)
    private String variableLabel;

    @Column(length = 40)
    private String unit;

    @Column(length = 20, nullable = false)
    private String type = "NUMBER";

    @Column(nullable = false)
    private Boolean required = true;

    @Column(precision = 20, scale = 6)
    private BigDecimal minValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal maxValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal defaultValue;

    private Integer displayOrder;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMethodTemplateId() { return methodTemplateId; }
    public void setMethodTemplateId(Long methodTemplateId) { this.methodTemplateId = methodTemplateId; }
    public String getVariableKey() { return variableKey; }
    public void setVariableKey(String variableKey) { this.variableKey = variableKey; }
    public String getVariableLabel() { return variableLabel; }
    public void setVariableLabel(String variableLabel) { this.variableLabel = variableLabel; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Boolean getRequired() { return required; }
    public void setRequired(Boolean required) { this.required = required; }
    public BigDecimal getMinValue() { return minValue; }
    public void setMinValue(BigDecimal minValue) { this.minValue = minValue; }
    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal maxValue) { this.maxValue = maxValue; }
    public BigDecimal getDefaultValue() { return defaultValue; }
    public void setDefaultValue(BigDecimal defaultValue) { this.defaultValue = defaultValue; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
