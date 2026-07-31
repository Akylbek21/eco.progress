package kz.eco.protocol;

import kz.eco.normative.*;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ProtocolNormativeCheckService {

    private final NormativeReferenceRepository normativeRepository;
    private final NormativeRecordRepository normativeRecordRepository;
    private final PollutantRepository pollutantRepository;
    private final ProtocolResultRepository resultRepository;
    private final ProtocolTemplateRepository templateRepository;
    private final ProtocolRepository protocolRepository;

    public ProtocolNormativeCheckService(NormativeReferenceRepository normativeRepository,
                                         NormativeRecordRepository normativeRecordRepository,
                                         PollutantRepository pollutantRepository,
                                         ProtocolResultRepository resultRepository,
                                         ProtocolTemplateRepository templateRepository,
                                         ProtocolRepository protocolRepository) {
        this.normativeRepository = normativeRepository;
        this.normativeRecordRepository = normativeRecordRepository;
        this.pollutantRepository = pollutantRepository;
        this.resultRepository = resultRepository;
        this.templateRepository = templateRepository;
        this.protocolRepository = protocolRepository;
    }

    @Transactional
    public void checkProtocol(Long protocolId, String objectType, LocalDate onDate) {
        Protocol protocol = protocolRepository.findById(protocolId)
                .orElseThrow(() -> new kz.eco.common.exception.NotFoundException("Протокол не найден: " + protocolId));
        ProtocolTemplate template = templateRepository.findById(protocol.getTemplateId())
                .orElseThrow(() -> new kz.eco.common.exception.NotFoundException("Шаблон не найден"));
        LocalDate effectiveDate = onDate != null ? onDate : protocol.getTestDate() != null
                ? protocol.getTestDate() : LocalDate.now();

        List<String> warnings = new ArrayList<>();
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId);
        TemplateType templateType = mapTemplateCode(normalizeTemplateCode(template.getCode()));
        for (ProtocolResult result : results) {
            if (NormativeSnapshotHelper.hasNormativeSnapshot(result)) {
                applyNormativeFromSnapshot(result);
            } else if (templateType == TemplateType.PHYSICAL_FACTORS) {
                applyPhysicalFactorNormative(result, effectiveDate, warnings);
            } else {
                applyNormative(result, normalizeTemplateCode(template.getCode()), objectType, effectiveDate, warnings);
            }
            compareResult(result, warnings);
            resultRepository.save(result);
        }

        ComplianceStatus overall = calculateComplianceStatus(results);
        protocol.setComplianceStatus(overall.name());
        protocolRepository.save(protocol);
    }

    /**
     * A client-supplied {@code normativeId} is re-resolved from the database and its authoritative
     * value/min/max/comparisonType/unit always win - {@code values.get("value")}/"min"/"max"/
     * "comparisonType" in the request are never trusted once a normativeId is present, even though
     * they may still be echoed in valuesJson (e.g. from a prior response round-trip). Without this,
     * a client could set compliance status directly by sending an arbitrary comparisonType/value
     * alongside any normativeId (spec §16). When no normativeId is present at all, the row has no
     * backend-verifiable normative to check against, so the client-sent value/min/max/comparisonType
     * are still applied as a "manual entry" fallback (pre-existing behavior) - closing that gap
     * fully requires the frontend's not-yet-implemented {@code manualNormative{reason}} contract.
     */
    private void applyNormativeFromSnapshot(ProtocolResult result) {
        Map<String, Object> values = ProtocolResultValuesMapper.readValuesMap(result);
        String normativeIdRaw = stringValue(values.get("normativeId"));
        Long normativeId = null;
        if (normativeIdRaw != null) {
            try {
                normativeId = Long.parseLong(normativeIdRaw);
            } catch (NumberFormatException ignored) {
            }
        }
        if (normativeId != null) {
            if (!applyResolvedNormativeById(result, normativeId)) {
                result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
            }
            return;
        }
        result.setNormativeValue(readDecimal(values.get("value")));
        result.setMinValue(readDecimal(values.get("min")));
        result.setMaxValue(readDecimal(values.get("max")));
        String comparison = stringValue(values.get("comparisonType"));
        if (comparison != null) {
            result.setComparisonType(ComparisonType.fromApi(comparison));
        }
    }

    /** Loads the normative row (it may live in either normative_records or the legacy
     *  normative_references table - ProtocolResult.normativeId has no discriminator column, so
     *  both are tried) and overwrites the result's value/min/max/comparisonType/unit from it.
     *  Returns false if the id no longer resolves to an active row (deleted, archived, or never
     *  existed), in which case the caller must NOT fall back to any client-sent value. */
    private boolean applyResolvedNormativeById(ProtocolResult result, Long normativeId) {
        Optional<NormativeRecord> record = normativeRecordRepository.findById(normativeId);
        if (record.isPresent()) {
            NormativeRecord rec = record.get();
            if (!rec.isActive()) {
                return false;
            }
            result.setNormativeId(rec.getId());
            result.setNormativeValue(rec.getValue());
            result.setMinValue(rec.getMinValue());
            result.setMaxValue(rec.getMaxValue());
            if (rec.getComparisonType() != null) {
                result.setComparisonType(rec.getComparisonType());
            }
            if (result.getUnit() == null || result.getUnit().isBlank()) {
                result.setUnit(rec.getUnit());
            }
            return true;
        }
        Optional<NormativeReference> reference = normativeRepository.findById(normativeId);
        if (reference.isPresent()) {
            NormativeReference ref = reference.get();
            result.setNormativeId(ref.getId());
            result.setNormativeType(ref.getNormativeType());
            result.setNormativeValue(ref.getNormativeValue());
            result.setMinValue(ref.getMinValue());
            result.setMaxValue(ref.getMaxValue());
            if (ref.getComparisonType() != null) {
                result.setComparisonType(ref.getComparisonType());
            }
            return true;
        }
        return false;
    }

    private void applyPhysicalFactorNormative(ProtocolResult result, LocalDate onDate, List<String> warnings) {
        Map<String, Object> values = ProtocolResultValuesMapper.readValuesMap(result);
        String factorType = stringValue(first(values, "factorType", "subtype"));
        String factorCode = stringValue(first(values, "factorCode", "code"));
        String season = stringValue(values.get("season"));
        String workCategory = stringValue(values.get("workCategory"));
        String workplaceType = stringValue(values.get("workplaceType"));
        String roomType = stringValue(first(values, "roomType", "roomOrWorkplace", "workplace"));
        String normLevel = stringValue(values.get("normLevel"));

        List<NormativeRecord> found = normativeRecordRepository.findPhysicalFactorNormatives(
                SourceDocumentCode.DSM_15.name(),
                TemplateType.PHYSICAL_FACTORS,
                factorType,
                factorCode,
                season,
                workCategory,
                workplaceType,
                roomType,
                normLevel,
                onDate);

        if (found.isEmpty() && result.getIndicatorName() != null) {
            found = normativeRecordRepository.findPhysicalFactorNormatives(
                    SourceDocumentCode.DSM_15.name(),
                    TemplateType.PHYSICAL_FACTORS,
                    factorType,
                    factorCode,
                    null, null, null, null, null,
                    onDate).stream()
                    .filter(n -> n.getIndicatorNameRu() != null
                            && n.getIndicatorNameRu().equalsIgnoreCase(result.getIndicatorName().trim()))
                    .toList();
        }

        if (found.isEmpty()) {
            result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
            warnings.add("Норматив не найден для физического фактора: "
                    + firstNonBlank(factorCode, result.getIndicatorName()));
            return;
        }
        if (found.size() > 1) {
            ProtocolResultValuesMapper.setExtraFlag(result, "normativeSelectionRequired", "true");
            result.setInternalStatus(ResultInternalStatus.NEEDS_REVIEW);
            warnings.add("Найдено несколько нормативов для фактора: " + factorCode);
            return;
        }

        NormativeSnapshotHelper.applySnapshotToResult(result, found.getFirst());
    }

    private ComplianceStatus calculateComplianceStatus(List<ProtocolResult> results) {
        if (results.isEmpty()) return ComplianceStatus.NEEDS_REVIEW;

        boolean hasExceeded = false;
        boolean hasNeedsReview = false;

        for (ProtocolResult result : results) {
            if (result.getInternalStatus() == null) continue;
            switch (result.getInternalStatus()) {
                case EXCEEDED, BELOW_REQUIRED -> hasExceeded = true;
                case NORMATIVE_NOT_FOUND, UNIT_MISMATCH, EMPTY_RESULT, NEEDS_REVIEW -> hasNeedsReview = true;
                default -> {}
            }
        }
        if (hasExceeded) return ComplianceStatus.DOES_NOT_COMPLY;
        if (hasNeedsReview) return ComplianceStatus.NEEDS_REVIEW;
        return ComplianceStatus.COMPLIES;
    }

    @Transactional
    public void applyNormativeToResult(ProtocolResult result, String templateCode, String objectType, LocalDate onDate) {
        List<String> warnings = new ArrayList<>();
        TemplateType templateType = mapTemplateCode(normalizeTemplateCode(templateCode));
        if (NormativeSnapshotHelper.hasNormativeSnapshot(result)) {
            applyNormativeFromSnapshot(result);
        } else if (templateType == TemplateType.PHYSICAL_FACTORS) {
            applyPhysicalFactorNormative(result, onDate, warnings);
        } else {
            applyNormative(result, normalizeTemplateCode(templateCode), objectType, onDate, warnings);
        }
        compareResult(result, warnings);
    }

    private void applyNormative(ProtocolResult result, String templateCode, String objectType,
                                LocalDate onDate, List<String> warnings) {
        if (result.getIndicatorName() == null || result.getIndicatorName().isBlank()) {
            return;
        }

        if (tryApplyByPollutantCode(result, templateCode, onDate, warnings)) {
            return;
        }

        List<NormativeReference> found = normativeRepository.searchActive(
                templateCode,
                result.getIndicatorName().trim(),
                objectType,
                result.getUnit(),
                onDate
        );
        if (found.isEmpty()) {
            result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
            warnings.add("Норматив не найден для показателя: " + result.getIndicatorName());
            return;
        }
        NormativeReference norm = found.getFirst();
        result.setNormativeId(norm.getId());
        result.setNormativeType(norm.getNormativeType());
        result.setNormativeValue(norm.getNormativeValue());
        result.setMinValue(norm.getMinValue());
        result.setMaxValue(norm.getMaxValue());
        result.setComparisonType(norm.getComparisonType());
        if (result.getTestingMethodNd() == null) {
            result.setTestingMethodNd(norm.getTestingMethodNd());
        }
        if (result.getSamplingMethodNd() == null) {
            result.setSamplingMethodNd(norm.getSamplingMethodNd());
        }
        if (result.getUnit() != null && norm.getUnit() != null
                && !result.getUnit().equalsIgnoreCase(norm.getUnit())) {
            result.setInternalStatus(ResultInternalStatus.UNIT_MISMATCH);
            warnings.add("Единица измерения не совпадает для: " + result.getIndicatorName());
        }
    }

    private boolean tryApplyByPollutantCode(ProtocolResult result, String templateCode, LocalDate onDate, List<String> warnings) {
        String code = result.getPollutantCode();
        if (code == null || code.isBlank()) {
            return false;
        }
        code = PollutantCodeUtils.normalizePollutantCode(code.trim());

        TemplateType templateType = mapTemplateCode(templateCode);
        if (templateType == null) {
            return false;
        }

        NormativeSourceResolver.ResolvedSource source = NormativeSourceResolver.resolve(templateCode, null);
        List<NormativeRecord> records;
        if (source.sourceDocumentCode() != null) {
            records = normativeRecordRepository.findBySourceAndPollutantCode(
                    source.sourceDocumentCode().name(),
                    source.environmentType(),
                    code,
                    onDate);
        } else {
            records = normativeRecordRepository.resolveByCodeAndTemplate(code, templateType, onDate);
        }

        if (records.isEmpty()) {
            return false;
        }
        if (records.size() > 1) {
            ProtocolResultValuesMapper.setExtraFlag(result, "normativeSelectionRequired", "true");
            result.setInternalStatus(ResultInternalStatus.NEEDS_REVIEW);
            warnings.add("Найдено несколько нормативов для кода: " + code);
            return true;
        }

        NormativeRecord norm = records.getFirst();
        NormativeSnapshotHelper.applySnapshotToResult(result, norm);

        if (result.getIndicatorName() == null || result.getIndicatorName().isBlank()) {
            if (norm.getIndicatorNameRu() != null) {
                result.setIndicatorName(norm.getIndicatorNameRu());
            } else {
                Pollutant p = pollutantRepository.findByCode(code).orElse(null);
                if (p != null) result.setIndicatorName(p.getNameRu());
            }
        }
        if (result.getUnit() == null || result.getUnit().isBlank()) {
            result.setUnit(norm.getUnit());
        }
        if (result.getUnit() != null && norm.getUnit() != null
                && !result.getUnit().equalsIgnoreCase(norm.getUnit())) {
            result.setInternalStatus(ResultInternalStatus.UNIT_MISMATCH);
            warnings.add("Единица измерения не совпадает для кода: " + code);
        }
        return true;
    }

    /** Delegates to the single canonical ProtocolTemplateMapper.toTemplateType (also recognises
     * all the DSM-15 synonyms: vibration, noise, infrasound, ultrasound, uv, aeroions,
     * electromagnetic_field, laser, uv_emf_laser - a fourth copy of this switch used to exist
     * here and, like the other three, didn't). */
    private TemplateType mapTemplateCode(String templateCode) {
        return ProtocolTemplateMapper.toTemplateType(templateCode);
    }

    private String normalizeTemplateCode(String templateCode) {
        if (templateCode == null || templateCode.isBlank()) {
            return null;
        }
        return templateCode.trim().toLowerCase();
    }

    public void compareResult(ProtocolResult result, List<String> warnings) {
        if (result.getComparisonType() == ComparisonType.ABSENT) {
            applyAbsentComparison(result);
            return;
        }
        BigDecimal value = resolveComparableValue(result);
        if (value == null) {
            result.setInternalStatus(ResultInternalStatus.EMPTY_RESULT);
            return;
        }
        if (result.getInternalStatus() == ResultInternalStatus.UNIT_MISMATCH) {
            return;
        }
        if (result.getComparisonType() == null) {
            if (result.getInternalStatus() != ResultInternalStatus.NORMATIVE_NOT_FOUND) {
                result.setInternalStatus(ResultInternalStatus.INFO);
            }
            return;
        }
        switch (result.getComparisonType()) {
            case INFO -> result.setInternalStatus(ResultInternalStatus.INFO);
            case RANGE, BETWEEN -> {
                if (result.getMinValue() == null || result.getMaxValue() == null) {
                    result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
                    return;
                }
                boolean ok = value.compareTo(result.getMinValue()) >= 0 && value.compareTo(result.getMaxValue()) <= 0;
                result.setInternalStatus(ok ? ResultInternalStatus.NORMAL : ResultInternalStatus.EXCEEDED);
            }
            case EQUAL -> {
                if (result.getNormativeValue() == null) {
                    result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
                    return;
                }
                result.setInternalStatus(value.compareTo(result.getNormativeValue()) == 0
                        ? ResultInternalStatus.NORMAL : ResultInternalStatus.EXCEEDED);
            }
            case LESS_OR_EQUAL -> {
                if (result.getNormativeValue() == null) {
                    result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
                    return;
                }
                result.setInternalStatus(value.compareTo(result.getNormativeValue()) <= 0
                        ? ResultInternalStatus.NORMAL : ResultInternalStatus.EXCEEDED);
            }
            case GREATER_OR_EQUAL -> {
                if (result.getNormativeValue() == null) {
                    result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_FOUND);
                    return;
                }
                result.setInternalStatus(value.compareTo(result.getNormativeValue()) >= 0
                        ? ResultInternalStatus.NORMAL : ResultInternalStatus.BELOW_REQUIRED);
            }
        }
    }

    /**
     * A normative match for a quick-create measurement row: either a single unambiguous
     * NormativeRecord, or - when the lookup found more than one equally-plausible candidate -
     * no record plus a warning explaining what needs to be narrowed down. Callers must never
     * fall back to "just pick one" themselves; that ambiguity has to surface to the user.
     */
    public record NormativeResolution(NormativeRecord normative, String warning) {
        static NormativeResolution of(NormativeRecord normative) {
            return new NormativeResolution(normative, null);
        }

        static NormativeResolution ambiguous(String warning) {
            return new NormativeResolution(null, warning);
        }

        static NormativeResolution none() {
            return new NormativeResolution(null, null);
        }

        public boolean found() {
            return normative != null;
        }
    }

    public NormativeResolution resolveForQuickCreate(String templateId,
                                                      ProtocolApiDtos.QuickCreateMeasurement measurement,
                                                      ProtocolApiDtos.QuickCreateConditions conditions,
                                                      LocalDate onDate) {
        ProtocolTemplateCode code = ProtocolTemplateCode.fromApi(templateId);
        if (code != null && code.isPhysicalFactor()) {
            return resolvePhysicalNormative(measurement, conditions, onDate);
        }
        return resolveChemicalNormative(templateId, measurement, conditions, onDate);
    }

    private NormativeResolution resolvePhysicalNormative(ProtocolApiDtos.QuickCreateMeasurement measurement,
                                                          ProtocolApiDtos.QuickCreateConditions conditions,
                                                          LocalDate onDate) {
        String season = conditions != null ? conditions.season() : null;
        // workCategory is scoped per factorType/factorCode by the query below, so reusing it for
        // lighting's "категория зрительной работы" when the caller didn't send a plain workCategory
        // is safe and lets illumination normatives match without a dedicated column.
        String workCategory = conditions != null
                ? firstNonBlank(conditions.workCategory(), conditions.visualWorkCategory()) : null;
        String workplaceType = conditions != null ? conditions.workplaceType() : null;
        String roomType = conditions != null ? conditions.roomType() : null;
        String normLevel = conditions != null ? conditions.normLevel() : null;
        LocalDate effectiveDate = onDate != null ? onDate : LocalDate.now();

        List<NormativeRecord> found = normativeRecordRepository.findPhysicalFactorNormatives(
                SourceDocumentCode.DSM_15.name(),
                TemplateType.PHYSICAL_FACTORS,
                measurement.factorType(),
                measurement.factorCode(),
                season,
                workCategory,
                workplaceType,
                roomType,
                normLevel,
                effectiveDate);

        if (found.isEmpty() && measurement.indicatorName() != null && !measurement.indicatorName().isBlank()) {
            found = normativeRecordRepository.findPhysicalFactorNormatives(
                    SourceDocumentCode.DSM_15.name(),
                    TemplateType.PHYSICAL_FACTORS,
                    measurement.factorType(),
                    measurement.factorCode(),
                    null, null, null, null, null,
                    effectiveDate).stream()
                    .filter(n -> n.getIndicatorNameRu() != null
                            && n.getIndicatorNameRu().equalsIgnoreCase(measurement.indicatorName().trim()))
                    .toList();
        }
        if (found.isEmpty() && measurement.factorType() != null && measurement.factorCode() != null) {
            found = normativeRecordRepository.findPhysicalFactorNormatives(
                    SourceDocumentCode.DSM_15.name(),
                    TemplateType.PHYSICAL_FACTORS,
                    measurement.factorType(),
                    measurement.factorCode(),
                    null, null, null, null, null,
                    effectiveDate);
        }
        return finishResolution(found, "показателя " + firstNonBlank(measurement.factorCode(), measurement.indicatorName()));
    }

    private NormativeResolution resolveChemicalNormative(String templateId,
                                                          ProtocolApiDtos.QuickCreateMeasurement measurement,
                                                          ProtocolApiDtos.QuickCreateConditions conditions,
                                                          LocalDate onDate) {
        LocalDate effectiveDate = onDate != null ? onDate : LocalDate.now();
        NormativeSourceResolver.ResolvedSource source = NormativeSourceResolver.resolve(templateId, null);
        TemplateType templateType = mapTemplateCode(normalizeTemplateCode(templateId));
        boolean isWater = source.sourceDocumentCode() == SourceDocumentCode.DSM_138;

        if (measurement.pollutantCode() != null && !measurement.pollutantCode().isBlank()) {
            String pollutantCode = PollutantCodeUtils.normalizePollutantCode(measurement.pollutantCode().trim());
            List<NormativeRecord> records = queryChemicalByCode(source, templateType, pollutantCode, effectiveDate);
            if (isWater) {
                records = narrowByWaterContext(records, conditions);
            }
            if (!records.isEmpty()) {
                return finishResolution(records, "кода " + measurement.pollutantCode());
            }
        }

        if (measurement.indicatorName() != null && !measurement.indicatorName().isBlank()
                && source.sourceDocumentCode() != null) {
            List<NormativeRecord> byName = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                            source.sourceDocumentCode().name()).stream()
                    .filter(n -> templateType == null || n.getTemplateType() == templateType)
                    .filter(n -> n.getIndicatorNameRu() != null
                            && n.getIndicatorNameRu().equalsIgnoreCase(measurement.indicatorName().trim()))
                    .toList();
            if (isWater) {
                byName = narrowByWaterContext(byName, conditions);
            }
            if (!byName.isEmpty()) {
                return finishResolution(byName, "показателя " + measurement.indicatorName());
            }
        }
        return NormativeResolution.none();
    }

    /**
     * DSM_138 (water) carries several parallel normatives for the same pollutant code across
     * different water types/use categories (e.g. drinking vs surface water). Once the caller told
     * us which one applies, records that disagree with it are not candidates at all - this isn't
     * "pick the best match", it's ruling out normatives that are flatly wrong for this sample.
     */
    private List<NormativeRecord> narrowByWaterContext(List<NormativeRecord> records,
                                                         ProtocolApiDtos.QuickCreateConditions conditions) {
        if (records.size() <= 1 || conditions == null) {
            return records;
        }
        List<NormativeRecord> narrowed = records;
        if (conditions.waterType() != null && !conditions.waterType().isBlank()) {
            List<NormativeRecord> byType = narrowed.stream()
                    .filter(n -> n.getWaterType() == null || n.getWaterType().isBlank()
                            || n.getWaterType().equalsIgnoreCase(conditions.waterType().trim()))
                    .toList();
            if (!byType.isEmpty()) {
                narrowed = byType;
            }
        }
        if (narrowed.size() > 1 && conditions.waterUseCategory() != null && !conditions.waterUseCategory().isBlank()) {
            List<NormativeRecord> byCategory = narrowed.stream()
                    .filter(n -> n.getWaterUseCategory() == null || n.getWaterUseCategory().isBlank()
                            || n.getWaterUseCategory().equalsIgnoreCase(conditions.waterUseCategory().trim()))
                    .toList();
            if (!byCategory.isEmpty()) {
                narrowed = byCategory;
            }
        }
        return narrowed;
    }

    /** Exactly one candidate is a real match; zero is "not found"; more than one is ambiguity
     * that must surface to the user instead of silently picking the first row. */
    private NormativeResolution finishResolution(List<NormativeRecord> candidates, String subjectLabel) {
        if (candidates.isEmpty()) {
            return NormativeResolution.none();
        }
        if (candidates.size() == 1) {
            return NormativeResolution.of(candidates.getFirst());
        }
        return NormativeResolution.ambiguous(
                "Для " + subjectLabel + " найдено несколько подходящих нормативов ("
                        + candidates.size() + "). Требуется уточнение (например, тип воды/категория водопользования).");
    }

    private List<NormativeRecord> queryChemicalByCode(NormativeSourceResolver.ResolvedSource source,
                                                        TemplateType templateType,
                                                        String pollutantCode,
                                                        LocalDate effectiveDate) {
        if (source.sourceDocumentCode() != null) {
            return normativeRecordRepository.findBySourceAndPollutantCode(
                    source.sourceDocumentCode().name(),
                    source.environmentType(),
                    pollutantCode,
                    effectiveDate);
        }
        if (templateType != null) {
            return normativeRecordRepository.resolveByCodeAndTemplate(pollutantCode, templateType, effectiveDate);
        }
        return List.of();
    }

    /**
     * ABSENT normatives (e.g. DSM_138 "Отсутствие" for pathogens) compare against free text, not
     * a numeric result column, so this reads the raw submitted value instead of
     * resolveComparableValue (which only looks at the numeric result* columns).
     */
    private void applyAbsentComparison(ProtocolResult result) {
        String raw = resolveRawTextValue(result);
        if (raw == null || raw.isBlank()) {
            result.setInternalStatus(ResultInternalStatus.EMPTY_RESULT);
            return;
        }
        String normalized = raw.trim().toLowerCase();
        if (normalized.contains("отсутств") || normalized.contains("не обнаружен")
                || normalized.equals("0") || normalized.equals("0.0") || normalized.equals("0,0")) {
            result.setInternalStatus(ResultInternalStatus.NORMAL);
        } else if (normalized.matches("-?\\d+([.,]\\d+)?")) {
            // A numeric value was submitted where the normative requires absence - not compliant.
            result.setInternalStatus(ResultInternalStatus.EXCEEDED);
        } else {
            result.setInternalStatus(ResultInternalStatus.NEEDS_REVIEW);
        }
    }

    private String resolveRawTextValue(ProtocolResult result) {
        Map<String, Object> values = ProtocolResultValuesMapper.readValuesMap(result);
        Object raw = first(values, "result", "resultValue", "primaryReading");
        return raw != null ? String.valueOf(raw) : null;
    }

    public BigDecimal resolveComparableValue(ProtocolResult result) {
        if (result.getResultValue() != null) {
            return result.getResultValue();
        }
        if (result.getResultMgM3() != null) {
            return result.getResultMgM3();
        }
        if (result.getResultMgDm3() != null) {
            return result.getResultMgDm3();
        }
        if (result.getCoPercent() != null) {
            return result.getCoPercent();
        }
        return null;
    }

    private static BigDecimal readDecimal(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof BigDecimal decimal) {
            return decimal;
        }
        if (raw instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(String.valueOf(raw).trim().replace(',', '.'));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String stringValue(Object raw) {
        return raw == null ? null : String.valueOf(raw).trim();
    }

    private static Object first(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null && !String.valueOf(value).isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
