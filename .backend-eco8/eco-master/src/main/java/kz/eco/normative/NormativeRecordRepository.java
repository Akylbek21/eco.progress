package kz.eco.normative;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface NormativeRecordRepository extends JpaRepository<NormativeRecord, Long> {

    List<NormativeRecord> findByActiveTrueOrderByPollutantCodeAsc();

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.pollutantCode = :pollutantCode
              AND n.environmentType = :environmentType
              AND n.normativeType = :normativeType
              AND (:normativeSubType IS NULL OR n.normativeSubType = :normativeSubType)
              AND (:unit IS NULL OR n.unit IS NULL OR LOWER(n.unit) = LOWER(:unit))
              AND (n.effectiveFrom IS NULL OR n.effectiveFrom <= :onDate)
              AND (n.effectiveTo IS NULL OR n.effectiveTo >= :onDate)
            ORDER BY n.version DESC
            """)
    List<NormativeRecord> findActiveByPollutantAndType(
            @Param("pollutantCode") String pollutantCode,
            @Param("environmentType") EnvironmentType environmentType,
            @Param("normativeType") ImportNormativeType normativeType,
            @Param("normativeSubType") String normativeSubType,
            @Param("unit") String unit,
            @Param("onDate") LocalDate onDate
    );

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.pollutantCode = :code
              AND n.templateType = :templateType
              AND (n.effectiveFrom IS NULL OR n.effectiveFrom <= :onDate)
              AND (n.effectiveTo IS NULL OR n.effectiveTo >= :onDate)
            ORDER BY n.version DESC
            """)
    List<NormativeRecord> resolveByCodeAndTemplate(
            @Param("code") String code,
            @Param("templateType") TemplateType templateType,
            @Param("onDate") LocalDate onDate
    );

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.pollutantCode = :pollutantCode
              AND (:sourceDocumentCode IS NULL OR n.sourceDocumentCode = :sourceDocumentCode)
              AND (:templateType IS NULL OR n.templateType = :templateType)
              AND n.environmentType = :environmentType
              AND n.normativeType = :normativeType
              AND (:normativeSubType IS NULL OR n.normativeSubType = :normativeSubType)
              AND (COALESCE(n.unit, '') = COALESCE(:unit, ''))
            ORDER BY n.version DESC
            """)
    List<NormativeRecord> findDuplicatesByCode(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("templateType") TemplateType templateType,
            @Param("environmentType") EnvironmentType environmentType,
            @Param("normativeType") ImportNormativeType normativeType,
            @Param("normativeSubType") String normativeSubType,
            @Param("unit") String unit,
            @Param("pollutantCode") String pollutantCode
    );

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND (COALESCE(n.pollutantCode, '') = '')
              AND (:sourceDocumentCode IS NULL OR n.sourceDocumentCode = :sourceDocumentCode)
              AND (:templateType IS NULL OR n.templateType = :templateType)
              AND n.environmentType = :environmentType
              AND n.normativeType = :normativeType
              AND (:normativeSubType IS NULL OR n.normativeSubType = :normativeSubType)
              AND (COALESCE(n.unit, '') = COALESCE(:unit, ''))
              AND LOWER(COALESCE(n.indicatorNameRu, '')) = LOWER(COALESCE(:indicatorNameRu, ''))
              AND (COALESCE(n.casNumber, '') = COALESCE(:casNumber, ''))
              AND (COALESCE(n.sourceFile, '') = COALESCE(:sourceFile, ''))
            ORDER BY n.version DESC
            """)
    List<NormativeRecord> findDuplicatesByNameKey(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("templateType") TemplateType templateType,
            @Param("environmentType") EnvironmentType environmentType,
            @Param("normativeType") ImportNormativeType normativeType,
            @Param("normativeSubType") String normativeSubType,
            @Param("unit") String unit,
            @Param("indicatorNameRu") String indicatorNameRu,
            @Param("casNumber") String casNumber,
            @Param("sourceFile") String sourceFile
    );

    List<NormativeRecord> findByImportBatchId(Long importBatchId);

    @Query("SELECT n FROM NormativeRecord n WHERE n.active = true AND n.templateType = :templateType ORDER BY n.pollutantCode")
    List<NormativeRecord> findByTemplateType(@Param("templateType") TemplateType templateType);

    List<NormativeRecord> findBySourceDocumentCodeAndActiveTrue(String sourceDocumentCode);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.sourceDocumentCode = :sourceDocumentCode
              AND n.templateType = :templateType
              AND (:factorType IS NULL OR n.factorType = :factorType)
              AND (:factorCode IS NULL OR n.factorCode = :factorCode)
              AND (:season IS NULL OR n.season IS NULL OR n.season = :season)
              AND (:workCategory IS NULL OR n.workCategory IS NULL OR n.workCategory = :workCategory)
              AND (:workplaceType IS NULL OR n.workplaceType IS NULL OR n.workplaceType = :workplaceType OR n.workplaceType = 'ANY')
              AND (:roomType IS NULL OR n.roomType IS NULL OR n.roomType = :roomType)
              AND (:normLevel IS NULL OR n.normLevel IS NULL OR n.normLevel = :normLevel)
              AND (n.effectiveFrom IS NULL OR n.effectiveFrom <= :onDate)
              AND (n.effectiveTo IS NULL OR n.effectiveTo >= :onDate)
            ORDER BY n.version DESC
            """)
    List<NormativeRecord> findPhysicalFactorNormatives(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("templateType") TemplateType templateType,
            @Param("factorType") String factorType,
            @Param("factorCode") String factorCode,
            @Param("season") String season,
            @Param("workCategory") String workCategory,
            @Param("workplaceType") String workplaceType,
            @Param("roomType") String roomType,
            @Param("normLevel") String normLevel,
            @Param("onDate") LocalDate onDate);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.sourceDocumentCode = :sourceDocumentCode
              AND (:environmentType IS NULL OR n.environmentType = :environmentType)
              AND n.pollutantCode = :pollutantCode
              AND (n.effectiveFrom IS NULL OR n.effectiveFrom <= :onDate)
              AND (n.effectiveTo IS NULL OR n.effectiveTo >= :onDate)
            ORDER BY n.version DESC
            """)
    List<NormativeRecord> findBySourceAndPollutantCode(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("environmentType") EnvironmentType environmentType,
            @Param("pollutantCode") String pollutantCode,
            @Param("onDate") LocalDate onDate);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.templateType = :templateType
              AND (:factorType IS NULL OR n.factorType = :factorType)
              AND (:factorCode IS NULL OR n.factorCode = :factorCode)
              AND (COALESCE(:season, '') = '' OR n.season IS NULL OR n.season = :season)
              AND (COALESCE(:workCategory, '') = '' OR n.workCategory IS NULL OR n.workCategory = :workCategory)
              AND (COALESCE(:workplaceType, '') = '' OR n.workplaceType IS NULL OR n.workplaceType = :workplaceType)
              AND (COALESCE(:roomType, '') = '' OR n.roomType IS NULL OR n.roomType = :roomType)
              AND (COALESCE(:normLevel, '') = '' OR n.normLevel IS NULL OR n.normLevel = :normLevel)
              AND LOWER(n.indicatorNameRu) = LOWER(:indicatorName)
            """)
    List<NormativeRecord> findPhysicalFactorDuplicates(
            @Param("templateType") TemplateType templateType,
            @Param("factorType") String factorType,
            @Param("factorCode") String factorCode,
            @Param("season") String season,
            @Param("workCategory") String workCategory,
            @Param("workplaceType") String workplaceType,
            @Param("roomType") String roomType,
            @Param("normLevel") String normLevel,
            @Param("indicatorName") String indicatorName);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.sourceDocumentCode = :sourceDocumentCode
              AND n.appendixNo = :appendixNo
              AND n.tableNo = :tableNo
              AND n.factorType = :factorType
              AND n.factorCode = :factorCode
              AND (COALESCE(:season, '') = '' OR n.season = :season)
              AND (COALESCE(:workCategory, '') = '' OR n.workCategory = :workCategory)
              AND (COALESCE(:workplaceType, '') = '' OR n.workplaceType = :workplaceType)
              AND (COALESCE(:normLevel, '') = '' OR n.normLevel = :normLevel)
              AND (COALESCE(:roomType, '') = '' OR (n.roomType IS NULL AND :roomType IS NULL) OR n.roomType = :roomType)
              AND (COALESCE(:conditionJson, '') = '' OR (n.conditionJson IS NULL AND :conditionJson IS NULL) OR n.conditionJson = :conditionJson)
            """)
    List<NormativeRecord> findPhysicalFactorByUniqueKey(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("appendixNo") Integer appendixNo,
            @Param("tableNo") Integer tableNo,
            @Param("factorType") String factorType,
            @Param("factorCode") String factorCode,
            @Param("season") String season,
            @Param("workCategory") String workCategory,
            @Param("workplaceType") String workplaceType,
            @Param("normLevel") String normLevel,
            @Param("roomType") String roomType,
            @Param("conditionJson") String conditionJson);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND n.sourceDocumentCode = :sourceDocumentCode
              AND n.tableNo = :tableNo
              AND ((:indicatorNameRu IS NULL AND n.indicatorNameRu IS NULL) OR n.indicatorNameRu = :indicatorNameRu)
              AND ((:formType IS NULL AND n.formType IS NULL) OR n.formType = :formType)
              AND ((:matrixType IS NULL AND n.matrixType IS NULL) OR n.matrixType = :matrixType)
              AND ((:assessmentCategory IS NULL AND n.assessmentCategory IS NULL) OR n.assessmentCategory = :assessmentCategory)
              AND ((:pollutionDegree IS NULL AND n.pollutionDegree IS NULL) OR n.pollutionDegree = :pollutionDegree)
            """)
    List<NormativeRecord> findDsm32ByUniqueKey(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("tableNo") Integer tableNo,
            @Param("indicatorNameRu") String indicatorNameRu,
            @Param("formType") String formType,
            @Param("matrixType") String matrixType,
            @Param("assessmentCategory") String assessmentCategory,
            @Param("pollutionDegree") String pollutionDegree);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.sourceDocumentCode = :sourceDocumentCode
              AND ((:appendixNo IS NULL AND n.appendixNo IS NULL) OR n.appendixNo = :appendixNo)
              AND ((:tableNo IS NULL AND n.tableNo IS NULL) OR n.tableNo = :tableNo)
              AND ((:categoryCode IS NULL AND n.categoryCode IS NULL) OR n.categoryCode = :categoryCode)
              AND n.indicatorNameRu = :indicatorName
              AND ((:casNumber IS NULL AND n.casNumber IS NULL) OR n.casNumber = :casNumber)
              AND ((:unit IS NULL AND n.unit IS NULL) OR n.unit = :unit)
              AND ((:value IS NULL AND n.value IS NULL) OR n.value = :value)
            """)
    List<NormativeRecord> findDsm138ByUniqueKey(
            @Param("sourceDocumentCode") String sourceDocumentCode,
            @Param("appendixNo") Integer appendixNo,
            @Param("tableNo") Integer tableNo,
            @Param("categoryCode") String categoryCode,
            @Param("indicatorName") String indicatorName,
            @Param("casNumber") String casNumber,
            @Param("unit") String unit,
            @Param("value") java.math.BigDecimal value);

    @Query("""
            SELECT n FROM NormativeRecord n
            WHERE n.active = true
              AND (:templateType IS NULL OR n.templateType = :templateType)
              AND (:subtype IS NULL OR n.normativeSubType = :subtype)
              AND (:unit IS NULL OR n.unit IS NULL OR LOWER(n.unit) = LOWER(:unit))
              AND (:onDate IS NULL OR n.effectiveFrom IS NULL OR n.effectiveFrom <= :onDate)
              AND (:onDate IS NULL OR n.effectiveTo IS NULL OR n.effectiveTo >= :onDate)
              AND (
                :queryBlank = true OR
                LOWER(COALESCE(n.pollutantCode, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(n.indicatorNameRu, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(n.indicatorNameKz, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR
                LOWER(COALESCE(n.normativeDocument, '')) LIKE LOWER(CONCAT('%', :query, '%'))
              )
            ORDER BY n.pollutantCode, n.indicatorNameRu
            """)
    List<NormativeRecord> searchActive(
            @Param("query") String query,
            @Param("queryBlank") boolean queryBlank,
            @Param("templateType") TemplateType templateType,
            @Param("subtype") String subtype,
            @Param("unit") String unit,
            @Param("onDate") LocalDate onDate,
            org.springframework.data.domain.Pageable pageable);
}
