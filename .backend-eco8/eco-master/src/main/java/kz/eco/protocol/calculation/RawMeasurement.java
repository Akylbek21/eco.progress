package kz.eco.protocol.calculation;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "protocol_raw_measurements", indexes = {
        @Index(name = "idx_rm_result_id", columnList = "protocolResultId")
})
public class RawMeasurement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "protocol_result_id", nullable = false)
    private Long protocolResultId;

    @Column(nullable = false, length = 60)
    private String variableKey;

    @Column(precision = 20, scale = 6)
    private BigDecimal variableValue;

    @Column(length = 40)
    private String unit;

    @Column(length = 20, nullable = false)
    private String sourceType = "MANUAL";

    private Long deviceId;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProtocolResultId() { return protocolResultId; }
    public void setProtocolResultId(Long protocolResultId) { this.protocolResultId = protocolResultId; }
    public String getVariableKey() { return variableKey; }
    public void setVariableKey(String variableKey) { this.variableKey = variableKey; }
    public BigDecimal getVariableValue() { return variableValue; }
    public void setVariableValue(BigDecimal variableValue) { this.variableValue = variableValue; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
