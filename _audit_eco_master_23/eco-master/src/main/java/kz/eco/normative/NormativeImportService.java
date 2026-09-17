package kz.eco.normative;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.normative.dto.NormativeImportDtos;
import kz.eco.common.exception.ConflictException;
import kz.eco.protocol.ComparisonType;
import kz.eco.user.UserRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class NormativeImportService {

    private static final String CLASSPATH_XLS_PATTERN = "classpath:xls/*";

    private final NormativeRecordRepository normativeRepo;
    private final PollutantRepository pollutantRepo;
    private final SummationGroupRepository summationRepo;
    private final PollutantCodeGroupRepository codeGroupRepo;
    private final ImportBatchRepository batchRepo;
    private final NormativeAuditService auditService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public NormativeImportService(NormativeRecordRepository normativeRepo,
                                  PollutantRepository pollutantRepo,
                                  SummationGroupRepository summationRepo,
                                  PollutantCodeGroupRepository codeGroupRepo,
                                  ImportBatchRepository batchRepo,
                                  NormativeAuditService auditService,
                                  UserRepository userRepository,
                                  ObjectMapper objectMapper) {
        this.normativeRepo = normativeRepo;
        this.pollutantRepo = pollutantRepo;
        this.summationRepo = summationRepo;
        this.codeGroupRepo = codeGroupRepo;
        this.batchRepo = batchRepo;
        this.auditService = auditService;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    public static final String STATUS_PREVIEW = "PREVIEW";
    public static final String STATUS_PROCESSING = "PROCESSING";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_ROLLED_BACK = "ROLLED_BACK";
    /** Исторический статус подтверждённого импорта (DSM-32/DSM-15/DSM-138 и старые батчи). */
    public static final String STATUS_CONFIRMED_LEGACY = "CONFIRMED";

    private static final int MAX_STORED_ERRORS = 100;

    @Transactional
    public int importAllClasspathResources() throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource[] resources = resolver.getResources(CLASSPATH_XLS_PATTERN);
        int imported = 0;
        for (Resource resource : resources) {
            if (!resource.exists() || !resource.isReadable()) {
                continue;
            }
            String fileName = Objects.requireNonNullElse(resource.getFilename(), "unknown.xls");
            imported += importResource(resource.getContentAsByteArray(), fileName, null).imported();
        }
        return imported;
    }

    @Transactional
    public NormativeImportDtos.ImportConfirmResponse importResource(byte[] bytes, String fileName, Long batchId) throws IOException {
        FileTypeMapping mapping = FileTypeMapping.resolve(fileName);
        if (mapping == null) {
            throw new BadRequestException("Не удалось определить тип файла: " + fileName);
        }
        return importResource(bytes, fileName, batchId, mapping, null);
    }

    /**
     * Import variant used by manifest-driven folder scans: manifestEntry (when present) is
     * authoritative for templateType/environmentType/sourceDocumentCode/appendixNo/tableNo/factorType,
     * overriding the filename-based guess.
     */
    @Transactional
    public NormativeImportDtos.ImportConfirmResponse importResource(byte[] bytes, String fileName, Long batchId,
                                                                     NormativeManifestEntry manifestEntry) throws IOException {
        FileTypeMapping baseMapping = FileTypeMapping.resolve(fileName);
        if (baseMapping == null) {
            throw new BadRequestException("Не удалось определить тип файла: " + fileName);
        }
        FileTypeMapping mapping = FileTypeMapping.withManifestOverrides(baseMapping, manifestEntry);
        return importResource(bytes, fileName, batchId, mapping, manifestEntry);
    }

    private NormativeImportDtos.ImportConfirmResponse importResource(byte[] bytes, String fileName, Long batchId,
                                                                      FileTypeMapping mapping,
                                                                      NormativeManifestEntry manifestEntry) throws IOException {
        List<List<String>> rows = parseBytes(bytes, fileName);
        if (rows.size() < 2) {
            return new NormativeImportDtos.ImportConfirmResponse(batchId, 0, 0, 0, "Файл пуст");
        }

        int imported = 0;
        int updated = 0;
        int skipped = 0;

        if (mapping.isSummationGroup()) {
            imported = importSummationGroups(rows, NormativeTableParser.buildMergedHeaders(rows),
                    NormativeTableParser.findDataStartRow(rows, NormativeTableParser.buildMergedHeaders(rows)), fileName);
        } else if (mapping.isCodeGroup()) {
            imported = importCodeGroups(rows, NormativeTableParser.buildMergedHeaders(rows),
                    NormativeTableParser.findDataStartRow(rows, NormativeTableParser.buildMergedHeaders(rows)), fileName);
        } else {
            Map<String, Pollutant> pollutantCache = new HashMap<>();
            List<NormativeTableParser.ParsedNormativeRow> parsedRows = NormativeTableParser.parseDataRows(rows, mapping, fileName);
            for (NormativeTableParser.ParsedNormativeRow parsed : parsedRows) {
                if (!isValidParsedRow(parsed)) {
                    skipped++;
                    continue;
                }
                Pollutant pollutant = resolvePollutantCached(parsed, pollutantCache);
                NormativeRecord record = createOrUpdateNormative(parsed, mapping, pollutant, fileName, parsed.rowNumber(), batchId, manifestEntry);
                if (record == null) {
                    skipped++;
                } else if (record.getVersion() > 1) {
                    updated++;
                } else {
                    imported++;
                }
            }
        }

        return new NormativeImportDtos.ImportConfirmResponse(
                batchId, imported, updated, skipped,
                "Импортировано: " + imported + ", обновлено: " + updated + ", пропущено: " + skipped);
    }

    /**
     * Предпросмотр импорта. Не меняет справочник нормативов/загрязнителей - создаёт только
     * запись {@link ImportBatch} в статусе PREVIEW (нужна как importId для confirm/status), с
     * SHA-256 файла, чтобы confirm применил ровно провалидированный файл.
     */
    @Transactional
    public NormativeImportDtos.ImportPreviewResponse previewImport(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан или пуст");
        }
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown.xls";
        FileTypeMapping mapping = FileTypeMapping.resolve(fileName);
        if (mapping == null) {
            throw new BadRequestException("Не удалось определить тип файла: " + fileName);
        }

        byte[] bytes = file.getBytes();
        List<List<String>> rows = parseBytes(bytes, fileName);
        if (rows.size() < 2) {
            throw new BadRequestException("Файл пуст или содержит только заголовки");
        }

        List<String> errors = new ArrayList<>();
        List<NormativeImportDtos.ImportRowPreview> preview = new ArrayList<>();
        int validRows = 0, errorRows = 0, skippedRows = 0, duplicates = 0, newPollutants = 0, newNormatives = 0, updatedNormatives = 0;
        Set<String> seenKeys = new HashSet<>();

        List<NormativeTableParser.ParsedNormativeRow> parsedRows = NormativeTableParser.parseDataRows(rows, mapping, fileName);
        for (NormativeTableParser.ParsedNormativeRow parsed : parsedRows) {
            try {
                if (!isValidParsedRow(parsed)) {
                    // Пустые/служебные строки таблицы (подзаголовки, сноски) - не ошибка, но и не данные.
                    skippedRows++;
                    continue;
                }
                String status = "NEW";
                if (!seenKeys.add(inFileKey(parsed))) {
                    duplicates++;
                    status = "DUPLICATE_IN_FILE";
                    if (errors.size() < MAX_STORED_ERRORS) {
                        errors.add("Строка " + parsed.rowNumber() + ": повтор показателя «" + parsed.name()
                                + "» в файле - будет применено последнее значение");
                    }
                } else {
                    if (parsed.pollutantCode() != null && !parsed.pollutantCode().isBlank()
                            && !pollutantRepo.existsByCode(parsed.pollutantCode())) {
                        newPollutants++;
                    }
                    NormativeRecord current = mapping.environmentType() != null
                            ? currentActive(findExisting(parsed, mapping, fileName))
                            : null;
                    if (current == null) {
                        newNormatives++;
                    } else if (valuesEqual(current.getValue(), parsed.value())) {
                        duplicates++;
                        status = "DUPLICATE";
                    } else {
                        updatedNormatives++;
                        status = "UPDATE";
                    }
                }

                validRows++;
                if (preview.size() < 50) {
                    preview.add(new NormativeImportDtos.ImportRowPreview(
                            parsed.rowNumber(), parsed.pollutantCode(), parsed.name(),
                            parsed.value() != null ? parsed.value().toPlainString() : "",
                            parsed.unit(), parsed.hazardClass(), status));
                }
            } catch (RuntimeException e) {
                errorRows++;
                if (errors.size() < MAX_STORED_ERRORS) {
                    errors.add("Строка " + parsed.rowNumber() + ": " + e.getMessage());
                }
            }
        }

        ImportBatch batch = new ImportBatch();
        batch.setFileName(truncate(fileName, 200));
        batch.setStatus(STATUS_PREVIEW);
        batch.setUserId(NormativeAuditService.currentUserId());
        batch.setFileHash(sha256(bytes));
        batch.setTotalRows(validRows + errorRows);
        batch.setValidRows(validRows);
        batch.setErrorRows(errorRows);
        batch.setSkippedRows(skippedRows);
        batch.setDuplicates(duplicates);
        batch.setNewPollutants(newPollutants);
        batch.setNewNormatives(newNormatives);
        batch.setUpdatedNormatives(updatedNormatives);
        batch.setErrorsJson(writeErrors(errors));
        batchRepo.save(batch);

        auditService.log(NormativeAuditService.ENTITY_IMPORT, batch.getId(), NormativeAuditService.ACTION_IMPORT_PREVIEW,
                null, Map.of("fileName", fileName, "totalRows", validRows + errorRows, "newNormatives", newNormatives,
                        "updatedNormatives", updatedNormatives, "duplicates", duplicates, "errorRows", errorRows),
                null);

        return new NormativeImportDtos.ImportPreviewResponse(
                batch.getId(), fileName, validRows + errorRows, validRows, errorRows,
                duplicates, newPollutants, newNormatives, updatedNormatives, errors, preview);
    }

    /**
     * Подтверждение импорта. Допускается только из PREVIEW (или FAILED - повторная попытка), только
     * с тем же файлом, что прошёл preview. Переход в PROCESSING - атомарный UPDATE, поэтому
     * повторный/параллельный confirm того же importId получает 409 и не создаёт дублей.
     */
    @Transactional
    public NormativeImportDtos.ImportConfirmResponse confirmImport(Long importId, MultipartFile file) throws IOException {
        ImportBatch batch = findBatch(importId);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан или пуст");
        }
        if (!STATUS_PREVIEW.equals(batch.getStatus()) && !STATUS_FAILED.equals(batch.getStatus())) {
            throw new ConflictException("Импорт #" + importId + " уже подтверждён или откатан (статус: "
                    + apiStatus(batch.getStatus()) + ")", "IMPORT_ALREADY_CONFIRMED");
        }
        byte[] bytes = file.getBytes();
        if (batch.getFileHash() != null && !batch.getFileHash().equals(sha256(bytes))) {
            throw new ConflictException("Файл отличается от файла, по которому выполнен предпросмотр. "
                    + "Выполните предпросмотр заново.", "IMPORT_FILE_MISMATCH");
        }
        if (batchRepo.transitionStatus(importId, List.of(STATUS_PREVIEW, STATUS_FAILED), STATUS_PROCESSING) == 0) {
            throw new ConflictException("Импорт #" + importId + " уже обрабатывается или подтверждён",
                    "IMPORT_ALREADY_CONFIRMED");
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : batch.getFileName();
        NormativeImportDtos.ImportConfirmResponse result = importResource(bytes, fileName, importId);

        ImportBatch processed = findBatch(importId);
        processed.setStatus(STATUS_COMPLETED);
        processed.setConfirmedAt(LocalDateTime.now());
        processed.setNewNormatives(result.imported());
        processed.setUpdatedNormatives(result.updated());
        processed.setSkippedRows(result.skipped());
        batchRepo.saveAndFlush(processed);

        auditService.log(NormativeAuditService.ENTITY_IMPORT, importId, NormativeAuditService.ACTION_IMPORT_CONFIRM,
                Map.of("status", STATUS_PREVIEW),
                Map.of("status", STATUS_COMPLETED, "created", result.imported(), "updated", result.updated(),
                        "skipped", result.skipped()),
                fileName);
        return result.withStatus(STATUS_COMPLETED);
    }

    /**
     * Фиксирует FAILED после того, как транзакция confirm откатилась из-за неожиданной ошибки.
     * Отдельная транзакция: вызывается снаружи (из контроллера), когда транзакция confirm уже
     * завершена - иначе запись статуса откатилась бы вместе с ней.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void markImportFailed(Long importId, String error) {
        if (importId == null
                || batchRepo.transitionStatus(importId, List.of(STATUS_PREVIEW, STATUS_PROCESSING), STATUS_FAILED) == 0) {
            return;
        }
        batchRepo.findById(importId).ifPresent(batch -> {
            List<String> errors = new ArrayList<>(readErrors(batch.getErrorsJson()));
            errors.add("Ошибка применения импорта: " + (error != null ? error : "неизвестная ошибка"));
            batch.setErrorsJson(writeErrors(errors));
            batchRepo.save(batch);
        });
        auditService.log(NormativeAuditService.ENTITY_IMPORT, importId, NormativeAuditService.ACTION_IMPORT_FAILED,
                null, Map.of("status", STATUS_FAILED), error);
    }

    @Transactional(readOnly = true)
    public NormativeImportDtos.ImportStatusResponse getImportStatus(Long importId) {
        return toStatus(findBatch(importId));
    }

    /**
     * Откат подтверждённого импорта:
     * <ul>
     *   <li>только COMPLETED (или исторический CONFIRMED); PREVIEW/PROCESSING/FAILED - 409;
     *       повторный rollback - 409 IMPORT_ALREADY_ROLLED_BACK;</li>
     *   <li>записи, созданные импортом, архивируются (не удаляются физически);</li>
     *   <li>версии, которые импорт заменил ({@code replacedRecordId}), снова становятся активными;</li>
     *   <li>если запись этого импорта уже заменил другой, ещё не откатанный импорт - 409: откат
     *       «из середины» затронул бы чужие данные, сначала нужно откатить более поздний импорт.</li>
     * </ul>
     */
    @Transactional
    public NormativeImportDtos.ImportStatusResponse rollbackImport(Long importId) {
        ImportBatch batch = findBatch(importId);
        String statusBefore = apiStatus(batch.getStatus());
        if (STATUS_ROLLED_BACK.equals(batch.getStatus())) {
            throw new ConflictException("Импорт #" + importId + " уже откатан", "IMPORT_ALREADY_ROLLED_BACK");
        }
        if (!STATUS_COMPLETED.equals(statusBefore)) {
            throw new ConflictException("Откатить можно только подтверждённый импорт (текущий статус: "
                    + statusBefore + ")", "IMPORT_NOT_CONFIRMED");
        }

        Set<Long> ownIds = new HashSet<>();
        normativeRepo.findByImportBatchId(importId).forEach(r -> ownIds.add(r.getId()));
        if (!ownIds.isEmpty()) {
            Optional<NormativeRecord> blocker = normativeRepo.findByReplacedRecordIdIn(ownIds).stream()
                    .filter(r -> r.isActive() && !Objects.equals(r.getImportBatchId(), importId))
                    .findFirst();
            if (blocker.isPresent()) {
                throw new ConflictException("Нормативы этого импорта уже заменены импортом #"
                        + blocker.get().getImportBatchId() + ". Сначала откатите более поздний импорт.",
                        "IMPORT_ROLLBACK_BLOCKED");
            }
        }

        if (batchRepo.transitionStatus(importId, List.of(STATUS_COMPLETED, STATUS_CONFIRMED_LEGACY), STATUS_ROLLED_BACK) == 0) {
            throw new ConflictException("Импорт #" + importId + " уже откатан", "IMPORT_ALREADY_ROLLED_BACK");
        }

        Long userId = NormativeAuditService.currentUserId();
        List<NormativeRecord> records = normativeRepo.findByImportBatchId(importId);
        List<Long> archivedIds = new ArrayList<>();
        Set<Long> replacedIds = new LinkedHashSet<>();
        for (NormativeRecord record : records) {
            if (record.isActive()) {
                record.setActive(false);
                record.setUpdatedBy(userId);
                archivedIds.add(record.getId());
            }
            if (record.getReplacedRecordId() != null && !ownIds.contains(record.getReplacedRecordId())) {
                replacedIds.add(record.getReplacedRecordId());
            }
        }
        normativeRepo.saveAll(records);

        List<Long> restoredIds = new ArrayList<>();
        List<NormativeRecord> replaced = normativeRepo.findAllById(replacedIds);
        for (NormativeRecord old : replaced) {
            if (!old.isActive()) {
                old.setActive(true);
                old.setUpdatedBy(userId);
                restoredIds.add(old.getId());
            }
        }
        normativeRepo.saveAllAndFlush(replaced);

        ImportBatch rolledBack = findBatch(importId);
        rolledBack.setRolledBackAt(LocalDateTime.now());
        rolledBack.setRolledBackBy(userId);
        batchRepo.saveAndFlush(rolledBack);

        auditService.log(NormativeAuditService.ENTITY_IMPORT, importId, NormativeAuditService.ACTION_IMPORT_ROLLBACK,
                Map.of("status", statusBefore),
                Map.of("status", STATUS_ROLLED_BACK, "archivedRecordIds", archivedIds, "restoredRecordIds", restoredIds),
                "Архивировано: " + archivedIds.size() + ", восстановлено предыдущих версий: " + restoredIds.size());
        return toStatus(rolledBack);
    }

    private ImportBatch findBatch(Long importId) {
        if (importId == null) {
            throw new BadRequestException("Не указан importId");
        }
        return batchRepo.findById(importId)
                .orElseThrow(() -> new NotFoundException("Импорт не найден: " + importId));
    }

    private NormativeImportDtos.ImportStatusResponse toStatus(ImportBatch batch) {
        String status = apiStatus(batch.getStatus());
        String createdByName = batch.getUserId() != null
                ? userRepository.findById(batch.getUserId()).map(kz.eco.user.User::getName).orElse(null)
                : null;
        List<String> errors = readErrors(batch.getErrorsJson());
        return new NormativeImportDtos.ImportStatusResponse(
                batch.getId(),
                batch.getId(),
                batch.getFileName(),
                status,
                iso(batch.getCreatedAt()),
                batch.getUserId(),
                createdByName,
                iso(batch.getConfirmedAt()),
                iso(batch.getRolledBackAt()),
                batch.getRolledBackBy(),
                batch.getTotalRows(),
                batch.getValidRows(),
                batch.getDuplicates(),
                batch.getNewNormatives(),
                batch.getUpdatedNormatives(),
                batch.getSkippedRows(),
                Math.max(batch.getErrorRows(), STATUS_FAILED.equals(status) ? errors.size() : 0),
                errors,
                STATUS_PREVIEW.equals(status) || STATUS_FAILED.equals(status),
                STATUS_COMPLETED.equals(status));
    }

    private static String apiStatus(String stored) {
        if (stored == null) {
            return STATUS_PREVIEW;
        }
        return STATUS_CONFIRMED_LEGACY.equals(stored) ? STATUS_COMPLETED : stored;
    }

    private static String iso(LocalDateTime value) {
        return value != null ? value.toString() : null;
    }

    private String writeErrors(List<String> errors) {
        if (errors == null || errors.isEmpty()) {
            return null;
        }
        return objectMapper.writeValueAsString(errors.size() > MAX_STORED_ERRORS ? errors.subList(0, MAX_STORED_ERRORS) : errors);
    }

    private List<String> readErrors(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (RuntimeException e) {
            return List.of(json);
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String inFileKey(NormativeTableParser.ParsedNormativeRow parsed) {
        String identity = isValidNumericCode(parsed.pollutantCode())
                ? "code:" + parsed.pollutantCode()
                : "name:" + Objects.toString(parsed.name(), "").trim().toLowerCase(Locale.ROOT)
                        + "|" + Objects.toString(parsed.casNumber(), "").trim();
        return identity + "|" + Objects.toString(parsed.subType(), "") + "|" + Objects.toString(parsed.unit(), "");
    }

    /** Действующая (active) версия среди найденных дублей; архивные версии не считаются текущими. */
    private static NormativeRecord currentActive(List<NormativeRecord> existing) {
        return existing.stream().filter(NormativeRecord::isActive).findFirst().orElse(null);
    }

    @Transactional(readOnly = true)
    public NormativeImportDtos.NormativeResolveResponse resolve(String templateTypeStr, String pollutantCode, java.time.LocalDate date) {
        TemplateType templateType;
        try {
            templateType = TemplateType.valueOf(templateTypeStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return new NormativeImportDtos.NormativeResolveResponse(
                    pollutantCode, null, templateTypeStr, null, null, null, null, null, null, "TEMPLATE_NOT_FOUND");
        }

        String normalizedCode = PollutantCodeUtils.normalizePollutantCode(pollutantCode);
        java.time.LocalDate onDate = date != null ? date : java.time.LocalDate.now();
        List<NormativeRecord> found = normativeRepo.resolveByCodeAndTemplate(normalizedCode, templateType, onDate);

        if (found.isEmpty()) {
            Pollutant p = pollutantRepo.findByCode(normalizedCode).orElse(null);
            return new NormativeImportDtos.NormativeResolveResponse(
                    normalizedCode, p != null ? p.getNameRu() : null, templateTypeStr,
                    null, null, null, null, null, null, "NOT_FOUND");
        }

        NormativeRecord norm = found.getFirst();
        Pollutant p = norm.getPollutantId() != null
                ? pollutantRepo.findById(norm.getPollutantId()).orElse(null)
                : pollutantRepo.findByCode(normalizedCode).orElse(null);

        return new NormativeImportDtos.NormativeResolveResponse(
                normalizedCode,
                p != null ? p.getNameRu() : norm.getIndicatorNameRu(),
                norm.getEnvironmentType() != null ? norm.getEnvironmentType().name() : templateTypeStr,
                norm.getNormativeType() != null ? norm.getNormativeType().name() : null,
                norm.getValue() != null ? norm.getValue().toPlainString() : null,
                norm.getUnit(),
                norm.getComparisonType() != null ? norm.getComparisonType().name() : null,
                norm.getNormativeDocument(),
                norm.getHazardClass(),
                "FOUND");
    }

    private Pollutant resolvePollutantCached(NormativeTableParser.ParsedNormativeRow parsed, Map<String, Pollutant> cache) {
        String code = parsed.pollutantCode();
        if (code == null || code.isBlank() || code.length() < 3 || !code.matches("\\d{3,10}")) {
            return null;
        }
        Pollutant cached = cache.get(code);
        if (cached != null) {
            return cached;
        }

        Optional<Pollutant> existing = pollutantRepo.findByCode(code);
        if (existing.isPresent()) {
            Pollutant p = existing.get();
            boolean updated = false;
            if (parsed.name() != null && !parsed.name().isBlank() && (p.getNameRu() == null || p.getNameRu().isBlank())) {
                p.setNameRu(parsed.name());
                updated = true;
            }
            if (parsed.casNumber() != null && !parsed.casNumber().isBlank() && (p.getCasNumber() == null || p.getCasNumber().isBlank())) {
                p.setCasNumber(parsed.casNumber());
                updated = true;
            }
            if (parsed.formula() != null && !parsed.formula().isBlank() && (p.getChemicalFormula() == null || p.getChemicalFormula().isBlank())) {
                p.setChemicalFormula(parsed.formula());
                updated = true;
            }
            if (updated) {
                pollutantRepo.save(p);
            }
            cache.put(code, p);
            return p;
        }

        Pollutant p = new Pollutant();
        p.setCode(truncate(code, 20));
        p.setNameRu(truncate(parsed.name(), 300));
        p.setCasNumber(truncate(parsed.casNumber(), 40));
        p.setChemicalFormula(truncate(parsed.formula(), 80));
        p.setHazardClass(truncate(parsed.hazardClass(), 10));
        p.setActive(true);
        p = pollutantRepo.save(p);
        cache.put(code, p);
        return p;
    }

    /**
     * Duplicate lookup key depends on whether the row has a real pollutant code:
     * a valid numeric code identifies the substance on its own, but a blank/garbage code
     * (common in tables with no code column) must not collapse unrelated substances onto
     * each other — those are matched by name+CAS+source file instead.
     */
    private List<NormativeRecord> findExisting(NormativeTableParser.ParsedNormativeRow parsed,
                                               FileTypeMapping mapping,
                                               String fileName) {
        if (isValidNumericCode(parsed.pollutantCode())) {
            return normativeRepo.findDuplicatesByCode(
                    mapping.sourceDocumentCode(), mapping.templateType(), mapping.environmentType(),
                    mapping.normativeType(), parsed.subType(), parsed.unit(), parsed.pollutantCode());
        }
        return normativeRepo.findDuplicatesByNameKey(
                mapping.sourceDocumentCode(), mapping.templateType(), mapping.environmentType(),
                mapping.normativeType(), parsed.subType(), parsed.unit(),
                parsed.name(), parsed.casNumber(), fileName);
    }

    private static boolean isValidNumericCode(String code) {
        return code != null && !code.isBlank() && code.matches("\\d{3,10}");
    }

    private NormativeRecord createOrUpdateNormative(NormativeTableParser.ParsedNormativeRow parsed,
                                                    FileTypeMapping mapping,
                                                    Pollutant pollutant,
                                                    String fileName,
                                                    int rowNum,
                                                    Long batchId,
                                                    NormativeManifestEntry manifestEntry) {
        List<NormativeRecord> existing = findExisting(parsed, mapping, fileName);

        if (!existing.isEmpty()) {
            NormativeRecord current = currentActive(existing);
            if (current != null && valuesEqual(current.getValue(), parsed.value())) {
                return null;
            }
            // Сравниваем с действующей версией, а не с максимальной: после rollback действующей
            // снова может быть более старая версия, и её тоже нужно погасить - иначе показатель
            // получил бы два активных норматива.
            Long userId = NormativeAuditService.currentUserId();
            Long replacedId = null;
            int maxVersion = 1;
            for (NormativeRecord ex : existing) {
                maxVersion = Math.max(maxVersion, ex.getVersion());
                if (ex.isActive()) {
                    ex.setActive(false);
                    ex.setUpdatedBy(userId);
                    normativeRepo.save(ex);
                    if (replacedId == null) {
                        replacedId = ex.getId();
                    }
                }
            }

            NormativeRecord newVersion = buildRecord(parsed, mapping, pollutant, fileName, rowNum, batchId, manifestEntry);
            newVersion.setVersion(maxVersion + 1);
            newVersion.setReplacedRecordId(replacedId);
            return normativeRepo.save(newVersion);
        }

        return normativeRepo.save(buildRecord(parsed, mapping, pollutant, fileName, rowNum, batchId, manifestEntry));
    }

    private NormativeRecord buildRecord(NormativeTableParser.ParsedNormativeRow parsed,
                                        FileTypeMapping mapping,
                                        Pollutant pollutant,
                                        String fileName,
                                        int rowNum,
                                        Long batchId,
                                        NormativeManifestEntry manifestEntry) {
        NormativeRecord r = new NormativeRecord();
        r.setPollutantId(pollutant != null ? pollutant.getId() : null);
        r.setPollutantCode(truncate(parsed.pollutantCode() != null ? parsed.pollutantCode() : "", 20));
        r.setIndicatorNameRu(truncate(parsed.name(), 300));
        r.setTemplateType(mapping.templateType());
        r.setEnvironmentType(mapping.environmentType());
        r.setNormativeType(mapping.normativeType());
        r.setNormativeSubType(truncate(parsed.subType(), 60));
        r.setUnit(truncate(parsed.unit(), 40));
        r.setValue(parsed.value());
        r.setMinValue(parsed.minValue());
        r.setMaxValue(parsed.maxValue());
        r.setComparisonType(mapping.comparisonType());
        r.setHazardClass(truncate(parsed.hazardClass(), 10));
        r.setLimitingIndicator(truncate(parsed.limitingIndicator(), 100));
        r.setCasNumber(truncate(parsed.casNumber(), 80));
        r.setChemicalFormula(truncate(parsed.formula(), 80));
        r.setNormativeDocument(truncate(parsed.document(), 300));
        r.setSourceFile(truncate(fileName, 200));
        r.setSourceRowNumber(rowNum);
        r.setSourceRawValue(truncate(parsed.rawValue(), 200));
        r.setImportBatchId(batchId);
        r.setCreatedBy(NormativeAuditService.currentUserId());
        r.setActive(true);
        r.setVersion(1);
        applySourceDocument(r, mapping);
        applyManifestMetadata(r, manifestEntry);
        return r;
    }

    private void applySourceDocument(NormativeRecord record, FileTypeMapping mapping) {
        if (mapping.sourceDocumentCode() != null) {
            record.setSourceDocumentCode(mapping.sourceDocumentCode());
            record.setSourceDocumentName(mapping.sourceDocumentName());
            SourceDocumentCode code = SourceDocumentCode.fromApi(mapping.sourceDocumentCode());
            if (code != null) {
                record.setDocumentNumber(code.documentNumber());
            }
        }
    }

    private void applyManifestMetadata(NormativeRecord record, NormativeManifestEntry manifestEntry) {
        if (manifestEntry == null) {
            return;
        }
        if (manifestEntry.sourceDocumentCode() != null && !manifestEntry.sourceDocumentCode().isBlank()) {
            record.setSourceDocumentCode(manifestEntry.sourceDocumentCode().trim());
        }
        if (manifestEntry.sourceDocumentName() != null && !manifestEntry.sourceDocumentName().isBlank()) {
            record.setSourceDocumentName(truncate(manifestEntry.sourceDocumentName(), 300));
        }
        if (manifestEntry.appendixNo() != null) {
            record.setAppendixNo(manifestEntry.appendixNo());
        }
        if (manifestEntry.tableNo() != null) {
            record.setTableNo(manifestEntry.tableNo());
        }
        if (manifestEntry.factorType() != null && !manifestEntry.factorType().isBlank()) {
            record.setFactorType(truncate(manifestEntry.factorType(), 60));
        }
    }

    private int importSummationGroups(List<List<String>> rows, List<String> headers, int start, String fileName) {
        int count = 0;
        for (int i = start; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (NormativeTableParser.isEmptyRow(row)) {
                continue;
            }
            String code = NormativeTableParser.getCell(row, NormativeTableParser.findCol(headers, "код", "номер", "группа", "№"));
            String name = NormativeTableParser.getCell(row, NormativeTableParser.findCol(headers, "наименование", "название", "вещество"));
            if (code == null || code.isBlank() || code.length() > 20) {
                continue;
            }
            if (summationRepo.existsByGroupCodeAndSourceFile(code.trim(), fileName)) {
                continue;
            }
            SummationGroup sg = new SummationGroup();
            sg.setGroupCode(code.trim());
            sg.setGroupName(name != null ? name.trim() : "");
            sg.setSourceFile(fileName);
            sg.setActive(true);
            summationRepo.save(sg);
            count++;
        }
        return count;
    }

    private int importCodeGroups(List<List<String>> rows, List<String> headers, int start, String fileName) {
        int count = 0;
        for (int i = start; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (NormativeTableParser.isEmptyRow(row)) {
                continue;
            }
            String code = NormativeTableParser.getCell(row, NormativeTableParser.findCol(headers, "код", "номер", "группа", "№"));
            String name = NormativeTableParser.getCell(row, NormativeTableParser.findCol(headers, "наименование", "название", "группа загрязняющ"));
            String from = NormativeTableParser.getCell(row, NormativeTableParser.findCol(headers, "от", "начало", "from"));
            String to = NormativeTableParser.getCell(row, NormativeTableParser.findCol(headers, "до", "конец", "to"));
            if (code == null || code.isBlank() || code.length() > 20) {
                continue;
            }
            if (codeGroupRepo.existsByGroupCodeAndSourceFile(code.trim(), fileName)) {
                continue;
            }
            PollutantCodeGroup cg = new PollutantCodeGroup();
            cg.setGroupCode(code.trim());
            cg.setGroupName(name != null ? name.trim() : "");
            cg.setCodeFrom(from != null ? from.trim() : null);
            cg.setCodeTo(to != null ? to.trim() : null);
            cg.setSourceFile(fileName);
            cg.setActive(true);
            codeGroupRepo.save(cg);
            count++;
        }
        return count;
    }

    private List<List<String>> parseFile(MultipartFile file) throws IOException {
        return parseBytes(file.getBytes(), file.getOriginalFilename());
    }

    private List<List<String>> parseBytes(byte[] bytes, String fileName) throws IOException {
        if (HtmlTableParser.isHtmlFile(bytes)) {
            return HtmlTableParser.parse(new ByteArrayInputStream(bytes)).rows();
        }
        return parseExcelFile(bytes, fileName);
    }

    private List<List<String>> parseExcelFile(byte[] bytes, String fileName) throws IOException {
        List<List<String>> rows = new ArrayList<>();
        try (Workbook workbook = createWorkbook(bytes, fileName)) {
            Sheet sheet = workbook.getSheetAt(0);
            for (int i = 0; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    rows.add(List.of());
                    continue;
                }
                List<String> cells = new ArrayList<>();
                for (int j = 0; j < row.getLastCellNum(); j++) {
                    cells.add(cellToString(row.getCell(j)));
                }
                rows.add(cells);
            }
        }
        return rows;
    }

    private Workbook createWorkbook(byte[] bytes, String fileName) throws IOException {
        try {
            return new XSSFWorkbook(new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            try {
                return new HSSFWorkbook(new ByteArrayInputStream(bytes));
            } catch (Exception e2) {
                throw new BadRequestException("Не удалось прочитать файл как Excel: " + fileName);
            }
        }
    }

    private String cellToString(Cell cell) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val) && !Double.isInfinite(val)) {
                    yield PollutantCodeUtils.normalizePollutantCode(String.valueOf((long) val));
                }
                yield String.valueOf(val);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield String.valueOf(cell.getNumericCellValue());
                } catch (Exception e) {
                    try {
                        yield cell.getStringCellValue();
                    } catch (Exception e2) {
                        yield "";
                    }
                }
            }
            default -> "";
        };
    }

    private boolean isValidParsedRow(NormativeTableParser.ParsedNormativeRow parsed) {
        if (parsed.value() == null) {
            return false;
        }
        boolean hasValidCode = parsed.pollutantCode() != null && !parsed.pollutantCode().isBlank()
                && parsed.pollutantCode().matches("\\d{3,10}");
        boolean hasValidName = parsed.name() != null && !parsed.name().isBlank()
                && parsed.name().length() > 2 && !parsed.name().matches("\\d+");
        return hasValidCode || hasValidName;
    }

    private static boolean valuesEqual(java.math.BigDecimal left, java.math.BigDecimal right) {
        if (left == null || right == null) {
            return left == null && right == null;
        }
        return left.stripTrailingZeros().compareTo(right.stripTrailingZeros()) == 0;
    }

    private static String truncate(String value, int maxLen) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }
}
