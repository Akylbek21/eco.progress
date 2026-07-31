package kz.eco.protocol;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "protocol_results")
public class ProtocolResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "protocol_id", nullable = false)
    private Long protocolId;

    @Column(name = "`row_number`", nullable = false)
    private Integer rowNumber;

    @Column(name = "sample_date")
    private LocalDate sampleDate;

    @Column(name = "sampling_place", length = 200)
    private String samplingPlace;

    @Column(name = "pollution_source_number", length = 80)
    private String pollutionSourceNumber;

    @Column(name = "object_name", length = 200)
    private String objectName;

    @Column(name = "sample_name", length = 200)
    private String sampleName;

    @Column(name = "indicator_name", length = 200)
    private String indicatorName;

    @Column(name = "unit", length = 40)
    private String unit;

    @Column(name = "testing_method_nd", length = 200)
    private String testingMethodNd;

    @Column(name = "sampling_method_nd", length = 200)
    private String samplingMethodNd;

    @Column(name = "normative_id")
    private Long normativeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "normative_type", length = 20)
    private NormativeType normativeType;

    @Column(name = "normative_value", precision = 20, scale = 6)
    private BigDecimal normativeValue;

    @Column(name = "min_value", precision = 20, scale = 6)
    private BigDecimal minValue;

    @Column(name = "max_value", precision = 20, scale = 6)
    private BigDecimal maxValue;

    @Column(name = "result_value", precision = 20, scale = 6)
    private BigDecimal resultValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "comparison_type", length = 30)
    private ComparisonType comparisonType;

    @Enumerated(EnumType.STRING)
    @Column(name = "internal_status", length = 30)
    private ResultInternalStatus internalStatus;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "temperature_c", precision = 10, scale = 2)
    private BigDecimal temperatureC;

    @Column(name = "flow_speed_ms", precision = 10, scale = 4)
    private BigDecimal flowSpeedMs;

    @Column(name = "gas_air_volume_nm3s", precision = 20, scale = 6)
    private BigDecimal gasAirVolumeNm3s;

    @Column(name = "duct_area_m2", precision = 20, scale = 6)
    private BigDecimal ductAreaM2;

    @Column(name = "pdv_mg_m3", precision = 20, scale = 6)
    private BigDecimal pdvMgM3;

    @Column(name = "pdv_gs", precision = 20, scale = 6)
    private BigDecimal pdvGs;

    @Column(name = "result_mg_m3", precision = 20, scale = 6)
    private BigDecimal resultMgM3;

    @Column(name = "result_gs", precision = 20, scale = 6)
    private BigDecimal resultGs;

    @Column(name = "pds_mg_dm3", precision = 20, scale = 6)
    private BigDecimal pdsMgDm3;

    @Column(name = "result_mg_dm3", precision = 20, scale = 6)
    private BigDecimal resultMgDm3;

    @Column(name = "pdk_mg_m3", precision = 20, scale = 6)
    private BigDecimal pdkMgM3;

    @Column(name = "pdk_or_background", precision = 20, scale = 6)
    private BigDecimal pdkOrBackground;

    @Column(name = "vehicle_model", length = 120)
    private String vehicleModel;

    @Column(name = "plate_number", length = 20)
    private String plateNumber;

    @Column(name = "co_percent", precision = 10, scale = 4)
    private BigDecimal coPercent;

    @Column(name = "ch_ppm", precision = 10, scale = 4)
    private BigDecimal chPpm;

    @Column(name = "smoke_k", precision = 10, scale = 4)
    private BigDecimal smokeK;

    @Column(name = "smoke_n_percent", precision = 10, scale = 4)
    private BigDecimal smokeNPercent;

    @Column(name = "measurement_place", length = 200)
    private String measurementPlace;

    @Column(name = "room_or_workplace", length = 200)
    private String roomOrWorkplace;

    @Column(name = "direction", length = 40)
    private String direction;

    @Column(name = "external_laboratory")
    private Boolean externalLaboratory;

    @Column(name = "external_laboratory_name", length = 255)
    private String externalLaboratoryName;

    @Column(name = "subtype", length = 40)
    private String subtype;

    @Column(name = "device_id")
    private Long deviceId;

    @Column(name = "verification_date")
    private LocalDate verificationDate;

    @Column(name = "verification_valid_until")
    private LocalDate verificationValidUntil;

    @Column(name = "pollutant_code", length = 64)
    private String pollutantCode;

    @Column(name = "method_template_id")
    private Long methodTemplateId;

    @Column(name = "uncertainty_value", precision = 20, scale = 6)
    private java.math.BigDecimal uncertaintyValue;

    @Column(name = "calculation_status", length = 40)
    private String calculationStatus;

    @Column(name = "calculation_message", length = 500)
    private String calculationMessage;

    @Column(name = "calculated_at")
    private java.time.LocalDateTime calculatedAt;

    @Column(name = "values_json", columnDefinition = "TEXT")
    private String valuesJson;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Integer getRowNumber() { return rowNumber; }
    public void setRowNumber(Integer rowNumber) { this.rowNumber = rowNumber; }
    public LocalDate getSampleDate() { return sampleDate; }
    public void setSampleDate(LocalDate sampleDate) { this.sampleDate = sampleDate; }
    public String getSamplingPlace() { return samplingPlace; }
    public void setSamplingPlace(String samplingPlace) { this.samplingPlace = samplingPlace; }
    public String getPollutionSourceNumber() { return pollutionSourceNumber; }
    public void setPollutionSourceNumber(String pollutionSourceNumber) { this.pollutionSourceNumber = pollutionSourceNumber; }
    public String getObjectName() { return objectName; }
    public void setObjectName(String objectName) { this.objectName = objectName; }
    public String getSampleName() { return sampleName; }
    public void setSampleName(String sampleName) { this.sampleName = sampleName; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String indicatorName) { this.indicatorName = indicatorName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getTestingMethodNd() { return testingMethodNd; }
    public void setTestingMethodNd(String testingMethodNd) { this.testingMethodNd = testingMethodNd; }
    public String getSamplingMethodNd() { return samplingMethodNd; }
    public void setSamplingMethodNd(String samplingMethodNd) { this.samplingMethodNd = samplingMethodNd; }
    public Long getNormativeId() { return normativeId; }
    public void setNormativeId(Long normativeId) { this.normativeId = normativeId; }
    public NormativeType getNormativeType() { return normativeType; }
    public void setNormativeType(NormativeType normativeType) { this.normativeType = normativeType; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public BigDecimal getMinValue() { return minValue; }
    public void setMinValue(BigDecimal minValue) { this.minValue = minValue; }
    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal maxValue) { this.maxValue = maxValue; }
    public BigDecimal getResultValue() { return resultValue; }
    public void setResultValue(BigDecimal resultValue) { this.resultValue = resultValue; }
    public ComparisonType getComparisonType() { return comparisonType; }
    public void setComparisonType(ComparisonType comparisonType) { this.comparisonType = comparisonType; }
    public ResultInternalStatus getInternalStatus() { return internalStatus; }
    public void setInternalStatus(ResultInternalStatus internalStatus) { this.internalStatus = internalStatus; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public BigDecimal getTemperatureC() { return temperatureC; }
    public void setTemperatureC(BigDecimal temperatureC) { this.temperatureC = temperatureC; }
    public BigDecimal getFlowSpeedMs() { return flowSpeedMs; }
    public void setFlowSpeedMs(BigDecimal flowSpeedMs) { this.flowSpeedMs = flowSpeedMs; }
    public BigDecimal getGasAirVolumeNm3s() { return gasAirVolumeNm3s; }
    public void setGasAirVolumeNm3s(BigDecimal gasAirVolumeNm3s) { this.gasAirVolumeNm3s = gasAirVolumeNm3s; }
    public BigDecimal getDuctAreaM2() { return ductAreaM2; }
    public void setDuctAreaM2(BigDecimal ductAreaM2) { this.ductAreaM2 = ductAreaM2; }
    public BigDecimal getPdvMgM3() { return pdvMgM3; }
    public void setPdvMgM3(BigDecimal pdvMgM3) { this.pdvMgM3 = pdvMgM3; }
    public BigDecimal getPdvGs() { return pdvGs; }
    public void setPdvGs(BigDecimal pdvGs) { this.pdvGs = pdvGs; }
    public BigDecimal getResultMgM3() { return resultMgM3; }
    public void setResultMgM3(BigDecimal resultMgM3) { this.resultMgM3 = resultMgM3; }
    public BigDecimal getResultGs() { return resultGs; }
    public void setResultGs(BigDecimal resultGs) { this.resultGs = resultGs; }
    public BigDecimal getPdsMgDm3() { return pdsMgDm3; }
    public void setPdsMgDm3(BigDecimal pdsMgDm3) { this.pdsMgDm3 = pdsMgDm3; }
    public BigDecimal getResultMgDm3() { return resultMgDm3; }
    public void setResultMgDm3(BigDecimal resultMgDm3) { this.resultMgDm3 = resultMgDm3; }
    public BigDecimal getPdkMgM3() { return pdkMgM3; }
    public void setPdkMgM3(BigDecimal pdkMgM3) { this.pdkMgM3 = pdkMgM3; }
    public BigDecimal getPdkOrBackground() { return pdkOrBackground; }
    public void setPdkOrBackground(BigDecimal pdkOrBackground) { this.pdkOrBackground = pdkOrBackground; }
    public String getVehicleModel() { return vehicleModel; }
    public void setVehicleModel(String vehicleModel) { this.vehicleModel = vehicleModel; }
    public String getPlateNumber() { return plateNumber; }
    public void setPlateNumber(String plateNumber) { this.plateNumber = plateNumber; }
    public BigDecimal getCoPercent() { return coPercent; }
    public void setCoPercent(BigDecimal coPercent) { this.coPercent = coPercent; }
    public BigDecimal getChPpm() { return chPpm; }
    public void setChPpm(BigDecimal chPpm) { this.chPpm = chPpm; }
    public BigDecimal getSmokeK() { return smokeK; }
    public void setSmokeK(BigDecimal smokeK) { this.smokeK = smokeK; }
    public BigDecimal getSmokeNPercent() { return smokeNPercent; }
    public void setSmokeNPercent(BigDecimal smokeNPercent) { this.smokeNPercent = smokeNPercent; }
    public String getMeasurementPlace() { return measurementPlace; }
    public void setMeasurementPlace(String measurementPlace) { this.measurementPlace = measurementPlace; }
    public String getRoomOrWorkplace() { return roomOrWorkplace; }
    public void setRoomOrWorkplace(String roomOrWorkplace) { this.roomOrWorkplace = roomOrWorkplace; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
    public Boolean getExternalLaboratory() { return externalLaboratory; }
    public void setExternalLaboratory(Boolean externalLaboratory) { this.externalLaboratory = externalLaboratory; }
    public String getExternalLaboratoryName() { return externalLaboratoryName; }
    public void setExternalLaboratoryName(String externalLaboratoryName) { this.externalLaboratoryName = externalLaboratoryName; }
    public String getSubtype() { return subtype; }
    public void setSubtype(String subtype) { this.subtype = subtype; }
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }
    public LocalDate getVerificationDate() { return verificationDate; }
    public void setVerificationDate(LocalDate verificationDate) { this.verificationDate = verificationDate; }
    public LocalDate getVerificationValidUntil() { return verificationValidUntil; }
    public void setVerificationValidUntil(LocalDate verificationValidUntil) { this.verificationValidUntil = verificationValidUntil; }
    public String getPollutantCode() { return pollutantCode; }
    public void setPollutantCode(String pollutantCode) { this.pollutantCode = pollutantCode; }
    public Long getMethodTemplateId() { return methodTemplateId; }
    public void setMethodTemplateId(Long methodTemplateId) { this.methodTemplateId = methodTemplateId; }
    public java.math.BigDecimal getUncertaintyValue() { return uncertaintyValue; }
    public void setUncertaintyValue(java.math.BigDecimal uncertaintyValue) { this.uncertaintyValue = uncertaintyValue; }
    public String getCalculationStatus() { return calculationStatus; }
    public void setCalculationStatus(String calculationStatus) { this.calculationStatus = calculationStatus; }
    public String getCalculationMessage() { return calculationMessage; }
    public void setCalculationMessage(String calculationMessage) { this.calculationMessage = calculationMessage; }
    public java.time.LocalDateTime getCalculatedAt() { return calculatedAt; }
    public void setCalculatedAt(java.time.LocalDateTime calculatedAt) { this.calculatedAt = calculatedAt; }
    public String getValuesJson() { return valuesJson; }
    public void setValuesJson(String valuesJson) { this.valuesJson = valuesJson; }
}
