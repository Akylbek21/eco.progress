package kz.eco.normative;

import kz.eco.common.exception.NotFoundException;
import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.NormativeReferenceService;
import kz.eco.protocol.ProtocolApiMapper;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class NormativeManagementService {

    private final NormativeRecordRepository normativeRecordRepository;
    private final NormativeReferenceService normativeReferenceService;
    private final NormativeRecordMapper normativeRecordMapper;

    public NormativeManagementService(NormativeRecordRepository normativeRecordRepository,
                                      NormativeReferenceService normativeReferenceService,
                                      NormativeRecordMapper normativeRecordMapper) {
        this.normativeRecordRepository = normativeRecordRepository;
        this.normativeReferenceService = normativeReferenceService;
        this.normativeRecordMapper = normativeRecordMapper;
    }

    /**
     * Creates a canonical {@link NormativeRecord}, not a legacy {@link kz.eco.protocol.NormativeReference} -
     * the legacy table can't hold factorType/casNumber/sourceDocumentCode/etc, and every field the
     * spec requires on create matches NormativeRecord's schema. NormativeReference stays a
     * read/update/archive-only fallback for rows that were already created there historically.
     */
    @Transactional
    public ProtocolApiDtos.NormativeRecord create(ProtocolApiDtos.NormativeUpsertRequest request) {
        Map<String, String> errors = NormativeRecordValidator.newErrorMap();
        NormativeRecordValidator.requireIndicatorAndSource(request.indicator(), request.sourceDocumentCode(), errors);
        String normalizedTemplateId = NormativeRecordValidator.validateAndNormalizeTemplateId(request.templateId(), errors);

        BigDecimal value = NormativeRecordValidator.parseNumeric("value", request.value(), errors);
        BigDecimal min = NormativeRecordValidator.parseNumeric("min", request.min(), errors);
        BigDecimal max = NormativeRecordValidator.parseNumeric("max", request.max(), errors);
        ComparisonType comparisonType = NormativeRecordValidator.parseComparisonType(request.comparisonType(), errors);
        NormativeRecordValidator.validateComparisonRules(comparisonType, value, min, max, errors);

        boolean isPhysical = NormativeApiContract.TEMPLATE_PHYSICAL_FACTORS.equals(normalizedTemplateId);
        FactorType factorType = NormativeRecordValidator.parseFactorType(request.factorType(), errors);
        if (factorType == null && isPhysical && request.factorType() == null) {
            errors.put("factorType", "Укажите factorType для физических факторов");
        }
        NormativeRecordValidator.throwIfErrors(errors);

        NormativeRecord record = new NormativeRecord();
        record.setIndicatorNameRu(request.indicator().trim());
        record.setUnit(trim(request.unit()));
        record.setNormativeSubType(trim(request.normativeSubType()));
        record.setValue(value);
        record.setMinValue(min);
        record.setMaxValue(max);
        record.setComparisonType(comparisonType);
        record.setHazardClass(trim(request.hazardClass()));
        record.setLimitingIndicator(trim(request.limitingIndicator()));
        record.setNormativeDocument(trim(request.normativeDocument()));
        record.setTestingMethod(trim(request.testingMethod()));
        record.setSamplingMethod(trim(request.samplingMethod()));
        record.setCasNumber(trim(request.casNumber()));
        record.setChemicalFormula(trim(request.chemicalFormula()));
        record.setSourceDocumentCode(request.sourceDocumentCode().trim().toUpperCase(Locale.ROOT));
        record.setSourceDocumentName(trim(request.sourceDocumentName()));
        record.setDocumentNumber(trim(request.documentNumber()));
        if (request.documentDate() != null && !request.documentDate().isBlank()) {
            record.setDocumentDate(ProtocolApiMapper.parseDate(request.documentDate()));
        }
        record.setAppendixNo(request.appendixNo());
        record.setTableNo(request.tableNo());
        record.setFactorType(factorType != null ? factorType.toApi() : null);
        record.setFactorCode(trim(request.factorCode()));
        record.setRoomType(trim(request.roomType()));
        record.setSeason(trim(request.season()));
        record.setWorkCategory(trim(request.workCategory()));
        record.setWorkplaceType(trim(request.workplaceType()));
        record.setNormLevel(trim(request.normLevel()));
        record.setConditionJson(trim(request.conditionJson()));
        if (request.validFrom() != null && !request.validFrom().isBlank()) {
            record.setEffectiveFrom(ProtocolApiMapper.parseDate(request.validFrom()));
        }
        if (request.validUntil() != null && !request.validUntil().isBlank()) {
            record.setEffectiveTo(ProtocolApiMapper.parseDate(request.validUntil()));
        }
        record.setActive(request.active() == null || request.active());
        record.setTemplateType(NormativeDirectoryService.resolveTemplateType(null, normalizedTemplateId));
        record.setEnvironmentType(inferEnvironmentType(record.getTemplateType()));

        return normativeRecordMapper.toApi(normativeRecordRepository.save(record), null);
    }

    @Transactional
    public ProtocolApiDtos.NormativeRecord update(Long id, ProtocolApiDtos.NormativeUpsertRequest request) {
        return normativeRecordRepository.findById(id)
                .map(record -> updateImportedRecord(record, request))
                .orElseGet(() -> normativeReferenceService.update(id, request));
    }

    @Transactional
    public ProtocolApiDtos.NormativeRecord archive(Long id) {
        return normativeRecordRepository.findById(id)
                .map(record -> {
                    record.setActive(false);
                    return normativeRecordMapper.toApi(normativeRecordRepository.save(record), null);
                })
                .orElseGet(() -> normativeReferenceService.archive(id));
    }

    /** Atomic bulk archive: any id that can't be resolved aborts the whole batch (the surrounding
     *  {@code @Transactional} rolls everything back), so callers never see a partial result. */
    @Transactional
    public List<ProtocolApiDtos.NormativeRecord> bulkArchive(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new kz.eco.common.exception.ValidationException("Укажите ids",
                    Map.of("ids", "Укажите хотя бы один идентификатор"));
        }
        return ids.stream().map(this::archive).toList();
    }

    private ProtocolApiDtos.NormativeRecord updateImportedRecord(NormativeRecord record,
                                                                 ProtocolApiDtos.NormativeUpsertRequest request) {
        Map<String, String> errors = NormativeRecordValidator.newErrorMap();

        BigDecimal value = request.value() != null
                ? NormativeRecordValidator.parseNumeric("value", request.value(), errors)
                : record.getValue();
        BigDecimal min = request.min() != null
                ? NormativeRecordValidator.parseNumeric("min", request.min(), errors)
                : record.getMinValue();
        BigDecimal max = request.max() != null
                ? NormativeRecordValidator.parseNumeric("max", request.max(), errors)
                : record.getMaxValue();
        ComparisonType comparisonType = request.comparisonType() != null
                ? NormativeRecordValidator.parseComparisonType(request.comparisonType(), errors)
                : record.getComparisonType();
        NormativeRecordValidator.validateComparisonRules(comparisonType, value, min, max, errors);

        FactorType factorType = null;
        boolean factorTypeChanged = request.factorType() != null;
        if (factorTypeChanged) {
            factorType = NormativeRecordValidator.parseFactorType(request.factorType(), errors);
        }
        NormativeRecordValidator.throwIfErrors(errors);

        if (request.indicator() != null) {
            record.setIndicatorNameRu(request.indicator().trim());
        }
        if (request.casNumber() != null) {
            record.setCasNumber(request.casNumber().trim());
        }
        if (request.chemicalFormula() != null) {
            record.setChemicalFormula(request.chemicalFormula().trim());
        }
        record.setValue(value);
        record.setMinValue(min);
        record.setMaxValue(max);
        record.setComparisonType(comparisonType);
        if (request.unit() != null) {
            record.setUnit(request.unit().trim());
        }
        if (request.normativeSubType() != null) {
            record.setNormativeSubType(request.normativeSubType().trim());
        }
        if (request.hazardClass() != null) {
            record.setHazardClass(request.hazardClass().trim());
        }
        if (request.limitingIndicator() != null) {
            record.setLimitingIndicator(request.limitingIndicator().trim());
        }
        if (request.normativeDocument() != null) {
            record.setNormativeDocument(request.normativeDocument().trim());
        }
        if (request.testingMethod() != null) {
            record.setTestingMethod(request.testingMethod().trim());
        }
        if (request.samplingMethod() != null) {
            record.setSamplingMethod(request.samplingMethod().trim());
        }
        if (factorTypeChanged) {
            record.setFactorType(factorType != null ? factorType.toApi() : null);
        }
        if (request.active() != null) {
            record.setActive(request.active());
        }
        return normativeRecordMapper.toApi(normativeRecordRepository.save(record), null);
    }

    private static EnvironmentType inferEnvironmentType(TemplateType templateType) {
        if (templateType == null) {
            return null;
        }
        return switch (templateType) {
            case ATMOSPHERIC_AIR -> EnvironmentType.ATMOSPHERIC_AIR;
            case WORK_ZONE_AIR -> EnvironmentType.WORK_ZONE_AIR;
            case SOIL -> EnvironmentType.SOIL;
            case WATER_WASTEWATER -> EnvironmentType.WATER;
            default -> null;
        };
    }

    private static String trim(String value) {
        return value != null ? value.trim() : null;
    }
}
