package kz.eco.protocol.calculation;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "protocol_repeatability_rules")
public class RepeatabilityRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "method_template_id", nullable = false)
    private Long methodTemplateId;

    @Column(length = 200)
    private String name;

    @Column(precision = 10, scale = 4)
    private BigDecimal maxDifferencePercent;

    @Column(length = 500)
    private String message;

    @Column(nullable = false)
    private Boolean active = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMethodTemplateId() { return methodTemplateId; }
    public void setMethodTemplateId(Long methodTemplateId) { this.methodTemplateId = methodTemplateId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getMaxDifferencePercent() { return maxDifferencePercent; }
    public void setMaxDifferencePercent(BigDecimal maxDifferencePercent) { this.maxDifferencePercent = maxDifferencePercent; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
