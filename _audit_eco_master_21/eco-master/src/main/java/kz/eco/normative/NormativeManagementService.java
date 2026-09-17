package kz.eco.normative;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.NormativeReferenceService;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class NormativeManagementService {

    private final NormativeRecordRepository normativeRecordRepository;
    private final NormativeReferenceService normativeReferenceService;
    private final NormativeRecordMapper normativeRecordMapper;
    private final NormativeAuditService auditService;

    public NormativeManagementService(NormativeRecordRepository normativeRecordRepository,
                                      NormativeReferenceService normativeReferenceService,
                                      NormativeRecordMapper normativeRecordMapper,
                                      NormativeAuditService auditService) {
        this.normativeRecordRepository = normativeRecordRepository;
        this.normativeReferenceService = normativeReferenceService;
        this.normativeRecordMapper = normativeRecordMapper;
        this.auditService = auditService;
    }

    public record RestoreResult(ProtocolApiDtos.NormativeRecord record, boolean alreadyActive) {
    }

    /** Канонический {@link NormativeRecord}, затем исторический {@link kz.eco.protocol.NormativeReference}
     *  (тот же порядок, что у update/archive). Архивные записи тоже отдаются - с active=false. */
    @Transactional(readOnly = true)
    public ProtocolApiDtos.NormativeRecord get(Long id) {
        return normativeRecordRepository.findById(id)
                .map(normativeRecordMapper::toApi)
                .orElseGet(() -> normativeReferenceService.get(id));
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
        LocalDate documentDate = parseDate("documentDate", request.documentDate(), errors);
        LocalDate validFrom = parseDate("validFrom", request.validFrom(), errors);
        LocalDate validUntil = parseDate("validUntil", request.validUntil(), errors);
        validatePeriod(validFrom, validUntil, errors);
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
        record.setDocumentDate(documentDate);
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
        record.setEffectiveFrom(validFrom);
        record.setEffectiveTo(validUntil);
        record.setActive(request.active() == null || request.active());
        record.setTemplateType(NormativeDirectoryService.resolveTemplateType(null, normalizedTemplateId));
        record.setEnvironmentType(inferEnvironmentType(record.getTemplateType()));
        Long userId = NormativeAuditService.currentUserId();
        record.setCreatedBy(userId);
        record.setUpdatedBy(userId);

        if (record.isActive()) {
            ensureNoActiveDuplicate(record);
        }
        NormativeRecord saved = normativeRecordRepository.save(record);
        ProtocolApiDtos.NormativeRecord dto = normativeRecordMapper.toApi(saved);
        auditService.log(NormativeAuditService.ENTITY_NORMATIVE, saved.getId(), NormativeAuditService.ACTION_CREATE,
                null, snapshot(dto), null);
        return dto;
    }

    @Transactional
    public ProtocolApiDtos.NormativeRecord update(Long id, ProtocolApiDtos.NormativeUpsertRequest request) {
        NormativeRecord record = normativeRecordRepository.findById(id).orElse(null);
        if (record == null) {
            ProtocolApiDtos.NormativeRecord before = normativeReferenceService.get(id);
            if (!before.active() && !Boolean.TRUE.equals(request.active())) {
                throw archivedConflict(id);
            }
            ProtocolApiDtos.NormativeRecord after = normativeReferenceService.update(id, request);
            auditService.log(NormativeAuditService.ENTITY_NORMATIVE, id, NormativeAuditService.ACTION_UPDATE,
                    snapshot(before), snapshot(after), "legacy normative_references");
            return after;
        }
        return updateImportedRecord(record, request);
    }

    /** Soft-delete. Повторное архивирование уже архивной записи - 200 с текущим состоянием, без
     *  второй audit-записи. */
    @Transactional
    public ProtocolApiDtos.NormativeRecord archive(Long id) {
        NormativeRecord record = normativeRecordRepository.findById(id).orElse(null);
        if (record == null) {
            ProtocolApiDtos.NormativeRecord before = normativeReferenceService.get(id);
            if (!before.active()) {
                return before;
            }
            ProtocolApiDtos.NormativeRecord after = normativeReferenceService.archive(id);
            auditService.log(NormativeAuditService.ENTITY_NORMATIVE, id, NormativeAuditService.ACTION_ARCHIVE,
                    snapshot(before), snapshot(after), "legacy normative_references");
            return after;
        }
        if (!record.isActive()) {
            return normativeRecordMapper.toApi(record);
        }
        ProtocolApiDtos.NormativeRecord before = normativeRecordMapper.toApi(record);
        record.setActive(false);
        record.setUpdatedBy(NormativeAuditService.currentUserId());
        ProtocolApiDtos.NormativeRecord after = normativeRecordMapper.toApi(normativeRecordRepository.save(record));
        auditService.log(NormativeAuditService.ENTITY_NORMATIVE, id, NormativeAuditService.ACTION_ARCHIVE,
                snapshot(before), snapshot(after), null);
        return after;
    }

    /**
     * Восстановление архивного норматива. 404 - нет записи; уже активен - 200 с текущим DTO и
     * {@code alreadyActive=true} (идемпотентно); 409 NORMATIVE_DUPLICATE_ACTIVE - по тому же
     * показателю/условиям уже действует другая запись (например, более новая версия из импорта).
     */
    @Transactional
    public RestoreResult restore(Long id) {
        NormativeRecord record = normativeRecordRepository.findById(id).orElse(null);
        if (record == null) {
            ProtocolApiDtos.NormativeRecord before = normativeReferenceService.get(id);
            if (before.active()) {
                return new RestoreResult(before, true);
            }
            ProtocolApiDtos.NormativeRecord after = normativeReferenceService.restore(id);
            auditService.log(NormativeAuditService.ENTITY_NORMATIVE, id, NormativeAuditService.ACTION_RESTORE,
                    snapshot(before), snapshot(after), "legacy normative_references");
            return new RestoreResult(after, false);
        }
        if (record.isActive()) {
            return new RestoreResult(normativeRecordMapper.toApi(record), true);
        }
        ensureNoActiveDuplicate(record);
        ProtocolApiDtos.NormativeRecord before = normativeRecordMapper.toApi(record);
        record.setActive(true);
        record.setUpdatedBy(NormativeAuditService.currentUserId());
        ProtocolApiDtos.NormativeRecord after = normativeRecordMapper.toApi(normativeRecordRepository.save(record));
        auditService.log(NormativeAuditService.ENTITY_NORMATIVE, id, NormativeAuditService.ACTION_RESTORE,
                snapshot(before), snapshot(after), null);
        return new RestoreResult(after, false);
    }

    /** Atomic bulk archive: any id that can't be resolved aborts the whole batch (the surrounding
     *  {@code @Transactional} rolls everything back), so callers never see a partial result. */
    @Transactional
    public List<ProtocolApiDtos.NormativeRecord> bulkArchive(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new kz.eco.common.exception.ValidationException("Укажите ids",
                    Map.of("ids", "Укажите хотя бы один идентификатор"));
        }
        if (ids.stream().anyMatch(Objects::isNull)) {
            throw new kz.eco.common.exception.ValidationException("Укажите ids",
                    Map.of("ids", "Идентификатор не может быть пустым"));
        }
        return ids.stream().distinct().map(this::archive).toList();
    }

    private ProtocolApiDtos.NormativeRecord updateImportedRecord(NormativeRecord record,
                                                                 ProtocolApiDtos.NormativeUpsertRequest request) {
        if (!record.isActive() && !Boolean.TRUE.equals(request.active())) {
            throw archivedConflict(record.getId());
        }
        Map<String, String> errors = NormativeRecordValidator.newErrorMap();
        if (request.indicator() != null && request.indicator().isBlank()) {
            errors.put("indicator", "Наименование показателя не может быть пустым");
        }

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

        ProtocolApiDtos.NormativeRecord before = normativeRecordMapper.toApi(record);

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
        if (record.isActive()) {
            ensureNoActiveDuplicate(record);
        }
        record.setUpdatedBy(NormativeAuditService.currentUserId());
        ProtocolApiDtos.NormativeRecord after = normativeRecordMapper.toApi(normativeRecordRepository.save(record));
        auditService.log(NormativeAuditService.ENTITY_NORMATIVE, record.getId(), NormativeAuditService.ACTION_UPDATE,
                snapshot(before), snapshot(after), null);
        return after;
    }

    /**
     * Уникальность действующего норматива: в одном источнике (sourceDocumentCode) не может быть
     * двух активных записей с одинаковым показателем и одинаковыми условиями применения
     * (шаблон, подтип, единица, CAS, factorType/factorCode, помещение/сезон/категория работ/
     * рабочее место/уровень, conditionJson). Разные условия - это разные нормативы, не дубль.
     */
    private void ensureNoActiveDuplicate(NormativeRecord candidate) {
        if (candidate.getSourceDocumentCode() == null || candidate.getIndicatorNameRu() == null) {
            return;
        }
        boolean duplicate = normativeRecordRepository
                .findActiveBySourceAndIndicator(candidate.getSourceDocumentCode(), candidate.getIndicatorNameRu().trim())
                .stream()
                .filter(other -> !Objects.equals(other.getId(), candidate.getId()))
                .anyMatch(other -> sameConditions(candidate, other));
        if (duplicate) {
            throw new ConflictException("Активный норматив «" + candidate.getIndicatorNameRu()
                    + "» с такими же условиями уже существует в " + candidate.getSourceDocumentCode(),
                    "NORMATIVE_DUPLICATE_ACTIVE");
        }
    }

    private static boolean sameConditions(NormativeRecord a, NormativeRecord b) {
        return a.getTemplateType() == b.getTemplateType()
                && eq(a.getNormativeSubType(), b.getNormativeSubType())
                && eq(a.getUnit(), b.getUnit())
                && eq(a.getCasNumber(), b.getCasNumber())
                && eq(a.getPollutantCode(), b.getPollutantCode())
                && eq(a.getFactorType(), b.getFactorType())
                && eq(a.getFactorCode(), b.getFactorCode())
                && eq(a.getRoomType(), b.getRoomType())
                && eq(a.getSeason(), b.getSeason())
                && eq(a.getWorkCategory(), b.getWorkCategory())
                && eq(a.getWorkplaceType(), b.getWorkplaceType())
                && eq(a.getNormLevel(), b.getNormLevel())
                && eq(a.getConditionJson(), b.getConditionJson())
                && eq(a.getCategoryCode(), b.getCategoryCode())
                && eq(a.getWaterType(), b.getWaterType())
                && Objects.equals(a.getAppendixNo(), b.getAppendixNo())
                && Objects.equals(a.getTableNo(), b.getTableNo());
    }

    /** null и пустая строка - одно и то же «не задано»; сравнение без учёта регистра и пробелов по краям. */
    private static boolean eq(String a, String b) {
        String left = a == null ? "" : a.trim();
        String right = b == null ? "" : b.trim();
        return left.equalsIgnoreCase(right);
    }

    private static ConflictException archivedConflict(Long id) {
        return new ConflictException("Норматив " + id + " архивирован. Восстановите его перед изменением.",
                "NORMATIVE_ARCHIVED");
    }

    private static LocalDate parseDate(String field, String raw, Map<String, String> errors) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            errors.put(field, "Некорректная дата (ожидается ГГГГ-ММ-ДД): " + raw);
            return null;
        }
    }

    private static void validatePeriod(LocalDate from, LocalDate until, Map<String, String> errors) {
        if (from != null && until != null && until.isBefore(from)) {
            errors.put("validUntil", "Дата окончания действия раньше даты начала");
        }
    }

    /** Компактный снимок для audit_logs (VARCHAR(4000)) - полный DTO норматива туда не влезает. */
    private static Map<String, Object> snapshot(ProtocolApiDtos.NormativeRecord dto) {
        if (dto == null) {
            return null;
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", dto.id());
        map.put("indicator", dto.indicator());
        map.put("templateId", dto.templateId());
        map.put("sourceDocumentCode", dto.sourceDocumentCode());
        map.put("unit", dto.unit());
        map.put("comparisonType", dto.comparisonType());
        map.put("value", dto.value());
        map.put("min", dto.min());
        map.put("max", dto.max());
        map.put("hazardClass", dto.hazardClass());
        map.put("factorType", dto.factorType());
        map.put("active", dto.active());
        return map;
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
