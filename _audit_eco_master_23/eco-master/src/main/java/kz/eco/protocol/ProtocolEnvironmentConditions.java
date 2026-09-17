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

    /*
     * Protocol-wide (header-level) type-specific condition fields. These come from the
     * quick-create wizard's per-type "conditions" object (QuickCreateConditions) and previously
     * had no structured column: season/workCategory/workplaceType/roomType/normLevel were pushed
     * onto ProtocolResult's per-row valuesJson but silently dropped because they were listed in
     * ProtocolResultValuesMapper.KNOWN_VALUE_KEYS without any actual field mapping - see
     * ProtocolResultValuesMapper for the pre-existing dead branch. Since QuickCreateConditions is
     * supplied once per whole request and copied onto every result row, the fields are genuinely
     * protocol-wide, not per-measurement-row - hence one column each here (one row per protocol)
     * rather than duplicated per ProtocolResult row. factorType is NOT here: it already has a real
     * per-row home on ProtocolResult.subtype (see ProtocolResultValuesMapper#toValues/applyValues).
     */
    @Column(length = 120)
    private String season;

    @Column(name = "work_category", length = 120)
    private String workCategory;

    @Column(name = "room_type", length = 120)
    private String roomType;

    @Column(name = "workplace_type", length = 120)
    private String workplaceType;

    @Column(name = "lighting_type", length = 120)
    private String lightingType;

    @Column(name = "noise_type", length = 120)
    private String noiseType;

    @Column(name = "visual_work_category", length = 120)
    private String visualWorkCategory;

    @Column(name = "norm_level", length = 120)
    private String normLevel;

    @Column(name = "sample_number", length = 120)
    private String sampleNumber;

    @Column(name = "sampling_depth", length = 120)
    private String samplingDepth;

    @Column(name = "sampling_place", length = 500)
    private String samplingPlace;

    @Column(name = "water_type", length = 120)
    private String waterType;

    @Column(name = "water_use_category", length = 120)
    private String waterUseCategory;

    @Column(name = "factor_type", length = 120)
    private String factorType;

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
    public String getSeason() { return season; }
    public void setSeason(String season) { this.season = season; }
    public String getWorkCategory() { return workCategory; }
    public void setWorkCategory(String workCategory) { this.workCategory = workCategory; }
    public String getRoomType() { return roomType; }
    public void setRoomType(String roomType) { this.roomType = roomType; }
    public String getWorkplaceType() { return workplaceType; }
    public void setWorkplaceType(String workplaceType) { this.workplaceType = workplaceType; }
    public String getLightingType() { return lightingType; }
    public void setLightingType(String lightingType) { this.lightingType = lightingType; }
    public String getNoiseType() { return noiseType; }
    public void setNoiseType(String noiseType) { this.noiseType = noiseType; }
    public String getVisualWorkCategory() { return visualWorkCategory; }
    public void setVisualWorkCategory(String visualWorkCategory) { this.visualWorkCategory = visualWorkCategory; }
    public String getNormLevel() { return normLevel; }
    public void setNormLevel(String normLevel) { this.normLevel = normLevel; }
    public String getSampleNumber() { return sampleNumber; }
    public void setSampleNumber(String sampleNumber) { this.sampleNumber = sampleNumber; }
    public String getSamplingDepth() { return samplingDepth; }
    public void setSamplingDepth(String samplingDepth) { this.samplingDepth = samplingDepth; }
    public String getSamplingPlace() { return samplingPlace; }
    public void setSamplingPlace(String samplingPlace) { this.samplingPlace = samplingPlace; }
    public String getWaterType() { return waterType; }
    public void setWaterType(String waterType) { this.waterType = waterType; }
    public String getWaterUseCategory() { return waterUseCategory; }
    public void setWaterUseCategory(String waterUseCategory) { this.waterUseCategory = waterUseCategory; }
    public String getFactorType() { return factorType; }
    public void setFactorType(String factorType) { this.factorType = factorType; }
}
