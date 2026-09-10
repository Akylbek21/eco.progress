package kz.eco.normative;

import jakarta.persistence.*;
import kz.eco.protocol.ComparisonType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "normative_records", indexes = {
        @Index(name = "idx_nr_pollutant_code", columnList = "pollutantCode"),
        @Index(name = "idx_nr_env_type", columnList = "environmentType"),
        @Index(name = "idx_nr_active", columnList = "active")
})
public class NormativeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long pollutantId;

    @Column(length = 20)
    private String pollutantCode;

    @Column(length = 300)
    private String indicatorNameRu;

    @Column(length = 300)
    private String indicatorNameKz;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private TemplateType templateType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private EnvironmentType environmentType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ImportNormativeType normativeType;

    @Column(length = 60)
    private String normativeSubType;

    // 150 (not 40) because some DSM_138 microbiological indicators spell out a full unit
    // description (e.g. "Число бляшкообразующих единиц...") rather than a short symbol.
    @Column(length = 150)
    private String unit;

    @Column(name = "norm_value", precision = 20, scale = 6)
    private BigDecimal value;

    @Column(precision = 20, scale = 6)
    private BigDecimal minValue;

    @Column(precision = 20, scale = 6)
    private BigDecimal maxValue;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ComparisonType comparisonType;

    @Column(length = 10)
    private String hazardClass;

    @Column(length = 100)
    private String limitingIndicator;

    @Column(length = 300)
    private String normativeDocument;

    @Column(length = 300)
    private String testingMethod;

    @Column(length = 300)
    private String samplingMethod;

    @Column(length = 80)
    private String documentNumber;

    private LocalDate documentDate;

    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;

    @Column(nullable = false)
    private int version = 1;

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 200)
    private String sourceFile;

    private Integer sourceRowNumber;

    @Column(length = 200)
    private String sourceRawValue;

    @Column(length = 80)
    private String casNumber;

    @Column(length = 80)
    private String chemicalFormula;

    @Column(length = 40)
    private String sourceDocumentCode;

    @Column(length = 300)
    private String sourceDocumentName;

    private Integer appendixNo;
    private Integer tableNo;

    @Column(length = 60)
    private String factorType;

    @Column(length = 100)
    private String factorCode;

    @Column(length = 100)
    private String roomType;

    @Column(length = 40)
    private String season;

    @Column(length = 40)
    private String workCategory;

    @Column(length = 40)
    private String workplaceType;

    @Column(length = 40)
    private String normLevel;

    @Column(columnDefinition = "TEXT")
    private String conditionJson;

    @Column(length = 80)
    private String matrixType;

    @Column(length = 120)
    private String assessmentCategory;

    @Column(length = 120)
    private String pollutionDegree;

    @Column(length = 120)
    private String formType;

    private Long importBatchId;

    // --- DSM_138 (water) fields ---
    @Column(length = 60)
    private String categoryCode;

    @Column(length = 500)
    private String synonyms;

    @Column(precision = 20, scale = 6)
    private BigDecimal alternativeNormativeValue;

    @Column(length = 40)
    private String waterType;

    @Column(length = 120)
    private String waterUseCategory;

    @Column(length = 500)
    private String notes;

    @Column(length = 300)
    private String sectionName;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPollutantId() { return pollutantId; }
    public void setPollutantId(Long pollutantId) { this.pollutantId = pollutantId; }
    public String getPollutantCode() { return pollutantCode; }
    public void setPollutantCode(String pollutantCode) { this.pollutantCode = pollutantCode; }
    public String getIndicatorNameRu() { return indicatorNameRu; }
    public void setIndicatorNameRu(String indicatorNameRu) { this.indicatorNameRu = indicatorNameRu; }
    public String getIndicatorNameKz() { return indicatorNameKz; }
    public void setIndicatorNameKz(String indicatorNameKz) { this.indicatorNameKz = indicatorNameKz; }
    public TemplateType getTemplateType() { return templateType; }
    public void setTemplateType(TemplateType templateType) { this.templateType = templateType; }
    public EnvironmentType getEnvironmentType() { return environmentType; }
    public void setEnvironmentType(EnvironmentType environmentType) { this.environmentType = environmentType; }
    public ImportNormativeType getNormativeType() { return normativeType; }
    public void setNormativeType(ImportNormativeType normativeType) { this.normativeType = normativeType; }
    public String getNormativeSubType() { return normativeSubType; }
    public void setNormativeSubType(String normativeSubType) { this.normativeSubType = normativeSubType; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }
    public BigDecimal getMinValue() { return minValue; }
    public void setMinValue(BigDecimal minValue) { this.minValue = minValue; }
    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal maxValue) { this.maxValue = maxValue; }
    public ComparisonType getComparisonType() { return comparisonType; }
    public void setComparisonType(ComparisonType comparisonType) { this.comparisonType = comparisonType; }
    public String getHazardClass() { return hazardClass; }
    public void setHazardClass(String hazardClass) { this.hazardClass = hazardClass; }
    public String getLimitingIndicator() { return limitingIndicator; }
    public void setLimitingIndicator(String limitingIndicator) { this.limitingIndicator = limitingIndicator; }
    public String getNormativeDocument() { return normativeDocument; }
    public String getTestingMethod() { return testingMethod; }
    public void setTestingMethod(String testingMethod) { this.testingMethod = testingMethod; }
    public String getSamplingMethod() { return samplingMethod; }
    public void setSamplingMethod(String samplingMethod) { this.samplingMethod = samplingMethod; }
    public void setNormativeDocument(String normativeDocument) { this.normativeDocument = normativeDocument; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public LocalDate getDocumentDate() { return documentDate; }
    public void setDocumentDate(LocalDate documentDate) { this.documentDate = documentDate; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getSourceFile() { return sourceFile; }
    public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
    public Integer getSourceRowNumber() { return sourceRowNumber; }
    public void setSourceRowNumber(Integer sourceRowNumber) { this.sourceRowNumber = sourceRowNumber; }
    public String getSourceRawValue() { return sourceRawValue; }
    public void setSourceRawValue(String sourceRawValue) { this.sourceRawValue = sourceRawValue; }
    public String getCasNumber() { return casNumber; }
    public void setCasNumber(String casNumber) { this.casNumber = casNumber; }
    public String getChemicalFormula() { return chemicalFormula; }
    public void setChemicalFormula(String chemicalFormula) { this.chemicalFormula = chemicalFormula; }
    public String getSourceDocumentCode() { return sourceDocumentCode; }
    public void setSourceDocumentCode(String sourceDocumentCode) { this.sourceDocumentCode = sourceDocumentCode; }
    public String getSourceDocumentName() { return sourceDocumentName; }
    public void setSourceDocumentName(String sourceDocumentName) { this.sourceDocumentName = sourceDocumentName; }
    public Integer getAppendixNo() { return appendixNo; }
    public void setAppendixNo(Integer appendixNo) { this.appendixNo = appendixNo; }
    public Integer getTableNo() { return tableNo; }
    public void setTableNo(Integer tableNo) { this.tableNo = tableNo; }
    public String getFactorType() { return factorType; }
    public void setFactorType(String factorType) { this.factorType = factorType; }
    public String getFactorCode() { return factorCode; }
    public void setFactorCode(String factorCode) { this.factorCode = factorCode; }
    public String getRoomType() { return roomType; }
    public void setRoomType(String roomType) { this.roomType = roomType; }
    public String getSeason() { return season; }
    public void setSeason(String season) { this.season = season; }
    public String getWorkCategory() { return workCategory; }
    public void setWorkCategory(String workCategory) { this.workCategory = workCategory; }
    public String getWorkplaceType() { return workplaceType; }
    public void setWorkplaceType(String workplaceType) { this.workplaceType = workplaceType; }
    public String getNormLevel() { return normLevel; }
    public void setNormLevel(String normLevel) { this.normLevel = normLevel; }
    public String getConditionJson() { return conditionJson; }
    public void setConditionJson(String conditionJson) { this.conditionJson = conditionJson; }
    public String getMatrixType() { return matrixType; }
    public void setMatrixType(String matrixType) { this.matrixType = matrixType; }
    public String getAssessmentCategory() { return assessmentCategory; }
    public void setAssessmentCategory(String assessmentCategory) { this.assessmentCategory = assessmentCategory; }
    public String getPollutionDegree() { return pollutionDegree; }
    public void setPollutionDegree(String pollutionDegree) { this.pollutionDegree = pollutionDegree; }
    public String getFormType() { return formType; }
    public void setFormType(String formType) { this.formType = formType; }
    public Long getImportBatchId() { return importBatchId; }
    public void setImportBatchId(Long importBatchId) { this.importBatchId = importBatchId; }
    public String getCategoryCode() { return categoryCode; }
    public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }
    public String getSynonyms() { return synonyms; }
    public void setSynonyms(String synonyms) { this.synonyms = synonyms; }
    public BigDecimal getAlternativeNormativeValue() { return alternativeNormativeValue; }
    public void setAlternativeNormativeValue(BigDecimal alternativeNormativeValue) { this.alternativeNormativeValue = alternativeNormativeValue; }
    public String getWaterType() { return waterType; }
    public void setWaterType(String waterType) { this.waterType = waterType; }
    public String getWaterUseCategory() { return waterUseCategory; }
    public void setWaterUseCategory(String waterUseCategory) { this.waterUseCategory = waterUseCategory; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
