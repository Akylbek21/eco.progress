package kz.eco.protocol;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "protocol_environment_conditions")
public class ProtocolEnvironmentConditions {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long protocolId;

    @Column(name = "temperature_c", precision = 10, scale = 4)
    private BigDecimal temperatureC;

    @Column(name = "temperature_min_c", precision = 10, scale = 4)
    private BigDecimal temperatureMinC;

    @Column(name = "temperature_max_c", precision = 10, scale = 4)
    private BigDecimal temperatureMaxC;

    @Column(name = "humidity_percent", precision = 10, scale = 4)
    private BigDecimal humidityPercent;

    @Column(name = "humidity_min_percent", precision = 10, scale = 4)
    private BigDecimal humidityMinPercent;

    @Column(name = "humidity_max_percent", precision = 10, scale = 4)
    private BigDecimal humidityMaxPercent;

    @Column(name = "pressure_kpa", precision = 20, scale = 12)
    private BigDecimal pressureKpa;

    @Column(name = "wind_speed_ms", precision = 10, scale = 4)
    private BigDecimal windSpeedMs;

    @Column(length = 500)
    private String conditionsComment;

    /** Where the weather values came from (e.g. "MANUAL", "WEATHER_API") - see dataSource for a
     * more specific provider tag and manualChangeReason for why a value was hand-overridden. */
    @Column(length = 60)
    private String source;

    @Column(name = "data_source", length = 120)
    private String dataSource;

    @Column(name = "manual_change_reason", length = 500)
    private String manualChangeReason;

    @Column(name = "weather_observed_at")
    private OffsetDateTime weatherObservedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public BigDecimal getTemperatureC() { return temperatureC; }
    public void setTemperatureC(BigDecimal temperatureC) { this.temperatureC = temperatureC; }
    public BigDecimal getTemperatureMinC() { return temperatureMinC; }
    public void setTemperatureMinC(BigDecimal temperatureMinC) { this.temperatureMinC = temperatureMinC; }
    public BigDecimal getTemperatureMaxC() { return temperatureMaxC; }
    public void setTemperatureMaxC(BigDecimal temperatureMaxC) { this.temperatureMaxC = temperatureMaxC; }
    public BigDecimal getHumidityPercent() { return humidityPercent; }
    public void setHumidityPercent(BigDecimal humidityPercent) { this.humidityPercent = humidityPercent; }
    public BigDecimal getHumidityMinPercent() { return humidityMinPercent; }
    public void setHumidityMinPercent(BigDecimal humidityMinPercent) { this.humidityMinPercent = humidityMinPercent; }
    public BigDecimal getHumidityMaxPercent() { return humidityMaxPercent; }
    public void setHumidityMaxPercent(BigDecimal humidityMaxPercent) { this.humidityMaxPercent = humidityMaxPercent; }
    public BigDecimal getPressureKpa() { return pressureKpa; }
    public void setPressureKpa(BigDecimal pressureKpa) { this.pressureKpa = pressureKpa; }
    public BigDecimal getWindSpeedMs() { return windSpeedMs; }
    public void setWindSpeedMs(BigDecimal windSpeedMs) { this.windSpeedMs = windSpeedMs; }
    public String getConditionsComment() { return conditionsComment; }
    public void setConditionsComment(String conditionsComment) { this.conditionsComment = conditionsComment; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }
    public String getManualChangeReason() { return manualChangeReason; }
    public void setManualChangeReason(String manualChangeReason) { this.manualChangeReason = manualChangeReason; }
    public OffsetDateTime getWeatherObservedAt() { return weatherObservedAt; }
    public void setWeatherObservedAt(OffsetDateTime weatherObservedAt) { this.weatherObservedAt = weatherObservedAt; }
}
