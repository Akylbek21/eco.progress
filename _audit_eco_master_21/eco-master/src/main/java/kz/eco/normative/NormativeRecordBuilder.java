package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;

public final class NormativeRecordBuilder {

    private String id;
    private String code;
    private String pollutantCode;
    private String templateId;
    private String researchObject;
    private String environment;
    private String indicator;
    private String unit;
    private String normativeType;
    private String value;
    private String min;
    private String max;
    private String comparisonType;
    private String normativeDocument;
    private String testingMethod;
    private String samplingMethod;
    private String validFrom;
    private String validUntil;
    private String indicatorName;
    private String indicatorNameRu;
    private String indicatorNameKz;
    private String pollutantName;
    private String casNumber;
    private String formula;
    private String chemicalFormula;
    private String templateType;
    private String environmentType;
    private String normativeSubType;
    private String normativeValue;
    private String maxOneTimeValue;
    private String dailyAverageValue;
    private String singleValue;
    private String obuvValue;
    private String hazardClass;
    private String limitingIndicator;
    private String sourceFile;
    private boolean active = true;
    private Boolean archived = false;
    private String sourceDocumentCode;
    private String sourceDocumentName;
    private String documentNumber;
    private String documentDate;
    private Integer appendixNo;
    private Integer tableNo;
    private String factorType;
    private String factorCode;
    private String roomType;
    private String season;
    private String workCategory;
    private String workplaceType;
    private String normLevel;
    private String conditionJson;
    private String matrixType;
    private String assessmentCategory;
    private String pollutionDegree;
    private String formType;
    private String categoryCode;
    private String waterType;
    private String synonyms;
    private String waterUseCategory;

    public static NormativeRecordBuilder create() {
        return new NormativeRecordBuilder();
    }

    public NormativeRecordBuilder id(String id) { this.id = id; return this; }
    public NormativeRecordBuilder code(String code) { this.code = code; return this; }
    public NormativeRecordBuilder pollutantCode(String pollutantCode) { this.pollutantCode = pollutantCode; return this; }
    public NormativeRecordBuilder templateId(String templateId) { this.templateId = templateId; return this; }
    public NormativeRecordBuilder researchObject(String researchObject) { this.researchObject = researchObject; return this; }
    public NormativeRecordBuilder environment(String environment) { this.environment = environment; return this; }
    public NormativeRecordBuilder indicator(String indicator) { this.indicator = indicator; return this; }
    public NormativeRecordBuilder unit(String unit) { this.unit = unit; return this; }
    public NormativeRecordBuilder normativeType(String normativeType) { this.normativeType = normativeType; return this; }
    public NormativeRecordBuilder value(String value) { this.value = value; return this; }
    public NormativeRecordBuilder min(String min) { this.min = min; return this; }
    public NormativeRecordBuilder max(String max) { this.max = max; return this; }
    public NormativeRecordBuilder comparisonType(String comparisonType) { this.comparisonType = comparisonType; return this; }
    public NormativeRecordBuilder normativeDocument(String normativeDocument) { this.normativeDocument = normativeDocument; return this; }
    public NormativeRecordBuilder testingMethod(String testingMethod) { this.testingMethod = testingMethod; return this; }
    public NormativeRecordBuilder samplingMethod(String samplingMethod) { this.samplingMethod = samplingMethod; return this; }
    public NormativeRecordBuilder validFrom(String validFrom) { this.validFrom = validFrom; return this; }
    public NormativeRecordBuilder validUntil(String validUntil) { this.validUntil = validUntil; return this; }
    public NormativeRecordBuilder indicatorName(String indicatorName) { this.indicatorName = indicatorName; return this; }
    public NormativeRecordBuilder indicatorNameRu(String indicatorNameRu) { this.indicatorNameRu = indicatorNameRu; return this; }
    public NormativeRecordBuilder indicatorNameKz(String indicatorNameKz) { this.indicatorNameKz = indicatorNameKz; return this; }
    public NormativeRecordBuilder pollutantName(String pollutantName) { this.pollutantName = pollutantName; return this; }
    public NormativeRecordBuilder casNumber(String casNumber) { this.casNumber = casNumber; return this; }
    public NormativeRecordBuilder formula(String formula) { this.formula = formula; return this; }
    public NormativeRecordBuilder chemicalFormula(String chemicalFormula) { this.chemicalFormula = chemicalFormula; return this; }
    public NormativeRecordBuilder templateType(String templateType) { this.templateType = templateType; return this; }
    public NormativeRecordBuilder environmentType(String environmentType) { this.environmentType = environmentType; return this; }
    public NormativeRecordBuilder normativeSubType(String normativeSubType) { this.normativeSubType = normativeSubType; return this; }
    public NormativeRecordBuilder normativeValue(String normativeValue) { this.normativeValue = normativeValue; return this; }
    public NormativeRecordBuilder maxOneTimeValue(String maxOneTimeValue) { this.maxOneTimeValue = maxOneTimeValue; return this; }
    public NormativeRecordBuilder dailyAverageValue(String dailyAverageValue) { this.dailyAverageValue = dailyAverageValue; return this; }
    public NormativeRecordBuilder singleValue(String singleValue) { this.singleValue = singleValue; return this; }
    public NormativeRecordBuilder obuvValue(String obuvValue) { this.obuvValue = obuvValue; return this; }
    public NormativeRecordBuilder hazardClass(String hazardClass) { this.hazardClass = hazardClass; return this; }
    public NormativeRecordBuilder limitingIndicator(String limitingIndicator) { this.limitingIndicator = limitingIndicator; return this; }
    public NormativeRecordBuilder sourceFile(String sourceFile) { this.sourceFile = sourceFile; return this; }
    public NormativeRecordBuilder active(boolean active) { this.active = active; return this; }
    public NormativeRecordBuilder archived(Boolean archived) { this.archived = archived; return this; }
    public NormativeRecordBuilder sourceDocumentCode(String sourceDocumentCode) { this.sourceDocumentCode = sourceDocumentCode; return this; }
    public NormativeRecordBuilder sourceDocumentName(String sourceDocumentName) { this.sourceDocumentName = sourceDocumentName; return this; }
    public NormativeRecordBuilder documentNumber(String documentNumber) { this.documentNumber = documentNumber; return this; }
    public NormativeRecordBuilder documentDate(String documentDate) { this.documentDate = documentDate; return this; }
    public NormativeRecordBuilder appendixNo(Integer appendixNo) { this.appendixNo = appendixNo; return this; }
    public NormativeRecordBuilder tableNo(Integer tableNo) { this.tableNo = tableNo; return this; }
    public NormativeRecordBuilder factorType(String factorType) { this.factorType = factorType; return this; }
    public NormativeRecordBuilder factorCode(String factorCode) { this.factorCode = factorCode; return this; }
    public NormativeRecordBuilder roomType(String roomType) { this.roomType = roomType; return this; }
    public NormativeRecordBuilder season(String season) { this.season = season; return this; }
    public NormativeRecordBuilder workCategory(String workCategory) { this.workCategory = workCategory; return this; }
    public NormativeRecordBuilder workplaceType(String workplaceType) { this.workplaceType = workplaceType; return this; }
    public NormativeRecordBuilder normLevel(String normLevel) { this.normLevel = normLevel; return this; }
    public NormativeRecordBuilder conditionJson(String conditionJson) { this.conditionJson = conditionJson; return this; }
    public NormativeRecordBuilder matrixType(String matrixType) { this.matrixType = matrixType; return this; }
    public NormativeRecordBuilder assessmentCategory(String assessmentCategory) { this.assessmentCategory = assessmentCategory; return this; }
    public NormativeRecordBuilder pollutionDegree(String pollutionDegree) { this.pollutionDegree = pollutionDegree; return this; }
    public NormativeRecordBuilder formType(String formType) { this.formType = formType; return this; }
    public NormativeRecordBuilder categoryCode(String categoryCode) { this.categoryCode = categoryCode; return this; }
    public NormativeRecordBuilder waterType(String waterType) { this.waterType = waterType; return this; }
    public NormativeRecordBuilder synonyms(String synonyms) { this.synonyms = synonyms; return this; }
    public NormativeRecordBuilder waterUseCategory(String waterUseCategory) { this.waterUseCategory = waterUseCategory; return this; }

    public ProtocolApiDtos.NormativeRecord build() {
        String resolvedIndicator = firstNonBlank(indicator, indicatorName, indicatorNameRu);
        String resolvedCode = firstNonBlank(code, pollutantCode);
        String resolvedValue = firstNonBlank(value, normativeValue);
        String resolvedTemplateId = NormativeApiContract.normalizeTemplateId(templateId);
        String resolvedSourceCode = sourceDocumentCode != null
                ? sourceDocumentCode.trim().toUpperCase()
                : NormativeApiContract.inferSourceDocumentCode(resolvedTemplateId);
        String resolvedSourceName = firstNonBlank(
                sourceDocumentName,
                NormativeApiContract.resolveSourceDocumentName(resolvedSourceCode));
        boolean resolvedArchived = archived != null ? archived : !active;

        return new ProtocolApiDtos.NormativeRecord(
                id,
                resolvedCode,
                pollutantCode,
                resolvedTemplateId,
                firstNonBlank(researchObject, environment),
                firstNonBlank(environment, templateEnvironmentSlug(environmentType)),
                resolvedIndicator,
                unit,
                normativeType,
                resolvedValue,
                min,
                max,
                comparisonType,
                normativeDocument,
                testingMethod,
                samplingMethod,
                validFrom,
                validUntil,
                firstNonBlank(indicatorName, resolvedIndicator),
                firstNonBlank(indicatorNameRu, resolvedIndicator),
                indicatorNameKz,
                firstNonBlank(pollutantName, resolvedIndicator),
                casNumber,
                firstNonBlank(formula, chemicalFormula),
                chemicalFormula,
                firstNonBlank(templateType, resolvedTemplateId),
                environmentType,
                normativeSubType,
                resolvedValue,
                maxOneTimeValue,
                dailyAverageValue,
                singleValue,
                obuvValue,
                hazardClass,
                limitingIndicator,
                sourceFile,
                active,
                resolvedArchived,
                resolvedSourceCode,
                resolvedSourceName,
                documentNumber,
                documentDate,
                appendixNo,
                tableNo,
                factorType,
                factorCode,
                roomType,
                season,
                workCategory,
                workplaceType,
                normLevel,
                conditionJson,
                matrixType,
                assessmentCategory,
                pollutionDegree,
                formType,
                categoryCode,
                waterType,
                synonyms,
                waterUseCategory
        );
    }

    private static String templateEnvironmentSlug(String environmentType) {
        if (environmentType == null || environmentType.isBlank()) {
            return null;
        }
        return environmentType.trim().toLowerCase();
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
