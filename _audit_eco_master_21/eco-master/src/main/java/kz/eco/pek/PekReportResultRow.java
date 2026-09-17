package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One row of the official (state-facing) PEK report - the actual measured result of one
 * {@code ProtocolResult}, resolved against the program's normative (control item + indicator) and
 * classified into the official table it belongs to ({@link PekOfficialTableType}).
 *
 * <p>Computed, not authored: {@link PekReportCollectionService#collect} rebuilds the full set for
 * a report on every run (delete-then-reinsert, same as a materialized view - there is nothing here
 * a user edits directly, so id-preserving upsert like {@link PekReportPlanFactRow} buys nothing).
 * The only persisted, historically-reproducible content is what
 * {@link kz.eco.pek.docgen.PekReportDocumentGenerationService} freezes into a
 * {@link PekReportDocumentVersion}'s {@code snapshotJson} at generation time - this table is the
 * live/current view collect() keeps in sync, not the signed record of what was once reported.
 *
 * <p>Deliberately NOT a copy of {@code ProtocolResult}'s raw columns: only the fields the official
 * tables (emissions/instrumentalMeasurements/calculatedEmissions/ambientAir/wastewater/water/soil/
 * radiation/marine) actually render are carried here, resolved to one normative/actual pair with an
 * explicit unit, whichever typed ProtocolResult column (pdvGs/resultGs, pdsMgDm3/resultMgDm3,
 * pdkMgM3/resultMgM3, ...) applies to this row's classification - see
 * {@link PekOfficialReportDataService#classify}.
 */
@Entity
@Table(name = "pek_report_result_rows",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_result_row_result",
                columnNames = {"report_id", "protocol_result_id"}))
public class PekReportResultRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Enumerated(EnumType.STRING)
    @Column(name = "section_type", nullable = false, length = 30)
    private PekOfficialTableType sectionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "monitoring_type", length = 30)
    private PekMonitoringType monitoringType;

    @Column(name = "control_item_id")
    private Long controlItemId;

    @Column(name = "monitoring_point_id")
    private Long monitoringPointId;

    @Column(name = "emission_source_id")
    private Long emissionSourceId;

    @Column(name = "water_outlet_id")
    private Long waterOutletId;

    @Column(name = "waste_source_id")
    private Long wasteSourceId;

    @Column(name = "program_indicator_id")
    private Long programIndicatorId;

    @Column(name = "protocol_id", nullable = false)
    private Long protocolId;

    @Column(name = "protocol_result_id", nullable = false)
    private Long protocolResultId;

    @Column(name = "indicator_name", length = 255)
    private String indicatorName;

    @Column(name = "indicator_code", length = 60)
    private String indicatorCode;

    @Column(name = "measurement_date")
    private LocalDate measurementDate;

    @Column(name = "measurement_method", length = 255)
    private String measurementMethod;

    @Column(length = 40)
    private String unit;

    @Column(name = "normative_value", precision = 20, scale = 6)
    private BigDecimal normativeValue;

    @Column(name = "normative_unit", length = 40)
    private String normativeUnit;

    /** Normative rate, g/s (emissions only). */
    @Column(name = "normative_gs", precision = 20, scale = 6)
    private BigDecimal normativeGs;

    /** Normative annual mass, t/year (emissions only; derived from normativeGs and the emission
     *  source's declared operating hours/year - see {@link PekOfficialReportDataService}). */
    @Column(name = "normative_tons_year", precision = 20, scale = 6)
    private BigDecimal normativeTonsYear;

    @Column(name = "actual_value", precision = 20, scale = 6)
    private BigDecimal actualValue;

    /** Actual rate, g/s (emissions only). */
    @Column(name = "actual_gs", precision = 20, scale = 6)
    private BigDecimal actualGs;

    /** Actual mass for the reporting quarter, t/quarter (emissions only). */
    @Column(name = "actual_tons_quarter", precision = 20, scale = 6)
    private BigDecimal actualTonsQuarter;

    /** Actual mass, t/year (emissions only - a running annualized figure, same basis as
     *  normativeTonsYear so the two are comparable). */
    @Column(name = "actual_tons_year", precision = 20, scale = 6)
    private BigDecimal actualTonsYear;

    @Column(nullable = false)
    private boolean exceedance;

    @Column(name = "exceedance_ratio", precision = 10, scale = 4)
    private BigDecimal exceedanceRatio;

    @Column(name = "corrective_action", length = 1000)
    private String correctiveAction;

    @Column(length = 1000)
    private String comment;

    /** AUTO (automatic collection) or MANUAL (human-confirmed link) - copied from the matching
     *  {@link PekReportProtocolSource#getMatchType()} this row was built from. */
    @Column(name = "source_type", length = 20)
    private String sourceType;

    /** Calculated-emissions extras (item 5) - only ever set for CALCULATED_EMISSIONS rows.
     *  calculationMethod mirrors ProtocolResult.testingMethodNd (the only methodology reference the
     *  domain model carries); rawMaterialName/rawMaterialConsumptionTons have no source in the
     *  current model and stay null until a raw-material-tracking entity exists - left nullable
     *  rather than fabricated. equipmentOperatingHours mirrors PekEmissionSource.operatingHoursPerYear. */
    @Column(name = "calculation_method", length = 255)
    private String calculationMethod;

    @Column(name = "raw_material_name", length = 255)
    private String rawMaterialName;

    @Column(name = "raw_material_consumption_tons", precision = 20, scale = 6)
    private BigDecimal rawMaterialConsumptionTons;

    @Column(name = "equipment_operating_hours")
    private Integer equipmentOperatingHours;

    /** The source protocol's {@code @Version} at the time this row was (re)built - lets a caller
     *  tell a stale row from a freshly recomputed one without re-touching ProtocolResult. */
    @Column(name = "source_version")
    private Long sourceVersion;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public PekOfficialTableType getSectionType() { return sectionType; }
    public void setSectionType(PekOfficialTableType sectionType) { this.sectionType = sectionType; }
    public PekMonitoringType getMonitoringType() { return monitoringType; }
    public void setMonitoringType(PekMonitoringType monitoringType) { this.monitoringType = monitoringType; }
    public Long getControlItemId() { return controlItemId; }
    public void setControlItemId(Long controlItemId) { this.controlItemId = controlItemId; }
    public Long getMonitoringPointId() { return monitoringPointId; }
    public void setMonitoringPointId(Long monitoringPointId) { this.monitoringPointId = monitoringPointId; }
    public Long getEmissionSourceId() { return emissionSourceId; }
    public void setEmissionSourceId(Long emissionSourceId) { this.emissionSourceId = emissionSourceId; }
    public Long getWaterOutletId() { return waterOutletId; }
    public void setWaterOutletId(Long waterOutletId) { this.waterOutletId = waterOutletId; }
    public Long getWasteSourceId() { return wasteSourceId; }
    public void setWasteSourceId(Long wasteSourceId) { this.wasteSourceId = wasteSourceId; }
    public Long getProgramIndicatorId() { return programIndicatorId; }
    public void setProgramIndicatorId(Long programIndicatorId) { this.programIndicatorId = programIndicatorId; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Long getProtocolResultId() { return protocolResultId; }
    public void setProtocolResultId(Long protocolResultId) { this.protocolResultId = protocolResultId; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String indicatorName) { this.indicatorName = indicatorName; }
    public String getIndicatorCode() { return indicatorCode; }
    public void setIndicatorCode(String indicatorCode) { this.indicatorCode = indicatorCode; }
    public LocalDate getMeasurementDate() { return measurementDate; }
    public void setMeasurementDate(LocalDate measurementDate) { this.measurementDate = measurementDate; }
    public String getMeasurementMethod() { return measurementMethod; }
    public void setMeasurementMethod(String measurementMethod) { this.measurementMethod = measurementMethod; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getNormativeValue() { return normativeValue; }
    public void setNormativeValue(BigDecimal normativeValue) { this.normativeValue = normativeValue; }
    public String getNormativeUnit() { return normativeUnit; }
    public void setNormativeUnit(String normativeUnit) { this.normativeUnit = normativeUnit; }
    public BigDecimal getNormativeGs() { return normativeGs; }
    public void setNormativeGs(BigDecimal normativeGs) { this.normativeGs = normativeGs; }
    public BigDecimal getNormativeTonsYear() { return normativeTonsYear; }
    public void setNormativeTonsYear(BigDecimal normativeTonsYear) { this.normativeTonsYear = normativeTonsYear; }
    public BigDecimal getActualValue() { return actualValue; }
    public void setActualValue(BigDecimal actualValue) { this.actualValue = actualValue; }
    public BigDecimal getActualGs() { return actualGs; }
    public void setActualGs(BigDecimal actualGs) { this.actualGs = actualGs; }
    public BigDecimal getActualTonsQuarter() { return actualTonsQuarter; }
    public void setActualTonsQuarter(BigDecimal actualTonsQuarter) { this.actualTonsQuarter = actualTonsQuarter; }
    public BigDecimal getActualTonsYear() { return actualTonsYear; }
    public void setActualTonsYear(BigDecimal actualTonsYear) { this.actualTonsYear = actualTonsYear; }
    public boolean isExceedance() { return exceedance; }
    public void setExceedance(boolean exceedance) { this.exceedance = exceedance; }
    public BigDecimal getExceedanceRatio() { return exceedanceRatio; }
    public void setExceedanceRatio(BigDecimal exceedanceRatio) { this.exceedanceRatio = exceedanceRatio; }
    public String getCorrectiveAction() { return correctiveAction; }
    public void setCorrectiveAction(String correctiveAction) { this.correctiveAction = correctiveAction; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getCalculationMethod() { return calculationMethod; }
    public void setCalculationMethod(String calculationMethod) { this.calculationMethod = calculationMethod; }
    public String getRawMaterialName() { return rawMaterialName; }
    public void setRawMaterialName(String rawMaterialName) { this.rawMaterialName = rawMaterialName; }
    public BigDecimal getRawMaterialConsumptionTons() { return rawMaterialConsumptionTons; }
    public void setRawMaterialConsumptionTons(BigDecimal rawMaterialConsumptionTons) { this.rawMaterialConsumptionTons = rawMaterialConsumptionTons; }
    public Integer getEquipmentOperatingHours() { return equipmentOperatingHours; }
    public void setEquipmentOperatingHours(Integer equipmentOperatingHours) { this.equipmentOperatingHours = equipmentOperatingHours; }
    public Long getSourceVersion() { return sourceVersion; }
    public void setSourceVersion(Long sourceVersion) { this.sourceVersion = sourceVersion; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
