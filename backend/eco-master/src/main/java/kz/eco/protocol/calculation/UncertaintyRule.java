package kz.eco.protocol.calculation;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "protocol_uncertainty_rules")
public class UncertaintyRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "method_template_id", nullable = false)
    private Long methodTemplateId;

    @Column(length = 200)
    private String name;

    @Column(precision = 20, scale = 6)
    private BigDecimal concentrationFrom;

    @Column(precision = 20, scale = 6)
    private BigDecimal concentrationTo;

    @Column(precision = 10, scale = 4)
    private BigDecimal uncertaintyPercent;

    @Column(precision = 20, scale = 6)
    private BigDecimal absoluteUncertainty;

    @Column(nullable = false)
    private Boolean active = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMethodTemplateId() { return methodTemplateId; }
    public void setMethodTemplateId(Long methodTemplateId) { this.methodTemplateId = methodTemplateId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getConcentrationFrom() { return concentrationFrom; }
    public void setConcentrationFrom(BigDecimal concentrationFrom) { this.concentrationFrom = concentrationFrom; }
    public BigDecimal getConcentrationTo() { return concentrationTo; }
    public void setConcentrationTo(BigDecimal concentrationTo) { this.concentrationTo = concentrationTo; }
    public BigDecimal getUncertaintyPercent() { return uncertaintyPercent; }
    public void setUncertaintyPercent(BigDecimal uncertaintyPercent) { this.uncertaintyPercent = uncertaintyPercent; }
    public BigDecimal getAbsoluteUncertainty() { return absoluteUncertainty; }
    public void setAbsoluteUncertainty(BigDecimal absoluteUncertainty) { this.absoluteUncertainty = absoluteUncertainty; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
