package kz.eco.normative;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.normative.dto.NormativeImportDtos;
import kz.eco.protocol.ComparisonType;
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

    public NormativeImportService(NormativeRecordRepository normativeRepo,
                                  PollutantRepository pollutantRepo,
                                  SummationGroupRepository summationRepo,
                                  PollutantCodeGroupRepository codeGroupRepo,
                                  ImportBatchRepository batchRepo) {
        this.normativeRepo = normativeRepo;
        this.pollutantRepo = pollutantRepo;
        this.summationRepo = summationRepo;
        this.codeGroupRepo = codeGroupRepo;
        this.batchRepo = batchRepo;
    }

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

    @Transactional
    public NormativeImportDtos.ImportPreviewResponse previewImport(MultipartFile file) throws IOException {
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown.xls";
        FileTypeMapping mapping = FileTypeMapping.resolve(fileName);
        if (mapping == null) {
            throw new BadRequestException("Не удалось определить тип файла: " + fileName);
        }

        List<List<String>> rows = parseFile(file);
        if (rows.size() < 2) {
            throw new BadRequestException("Файл пуст или содержит только заголовки");
        }

        List<String> errors = new ArrayList<>();
        List<NormativeImportDtos.ImportRowPreview> preview = new ArrayList<>();
        int validRows = 0, errorRows = 0, duplicates = 0, newPollutants = 0, newNormatives = 0, updatedNormatives = 0;

        List<NormativeTableParser.ParsedNormativeRow> parsedRows = NormativeTableParser.parseDataRows(rows, mapping, fileName);
        for (NormativeTableParser.ParsedNormativeRow parsed : parsedRows) {
            try {
                if (!isValidParsedRow(parsed)) {
                    continue;
                }
                String status = "NEW";
                if (parsed.pollutantCode() != null && !parsed.pollutantCode().isBlank()
                        && !pollutantRepo.existsByCode(parsed.pollutantCode())) {
                    newPollutants++;
                }

                if (mapping.environmentType() != null) {
                    List<NormativeRecord> existing = findExisting(parsed, mapping, fileName);
                    if (!existing.isEmpty()) {
                        NormativeRecord ex = existing.getFirst();
                        if (valuesEqual(ex.getValue(), parsed.value())) {
                            duplicates++;
                            status = "DUPLICATE";
                        } else {
                            updatedNormatives++;
                            status = "UPDATE";
                        }
                    } else {
                        newNormatives++;
                    }
                } else {
                    newNormatives++;
                }

                validRows++;
                if (preview.size() < 50) {
                    preview.add(new NormativeImportDtos.ImportRowPreview(
                            parsed.rowNumber(), parsed.pollutantCode(), parsed.name(),
                            parsed.value() != null ? parsed.value().toPlainString() : "",
                            parsed.unit(), parsed.hazardClass(), status));
                }
            } catch (Exception e) {
                errorRows++;
                if (errors.size() < 100) {
                    errors.add("Строка " + parsed.rowNumber() + ": " + e.getMessage());
                }
            }
        }

        ImportBatch batch = new ImportBatch();
        batch.setFileName(fileName);
        batch.setStatus("PREVIEW");
        batch.setTotalRows(validRows + errorRows);
        batch.setValidRows(validRows);
        batch.setErrorRows(errorRows);
        batch.setDuplicates(duplicates);
        batch.setNewPollutants(newPollutants);
        batch.setNewNormatives(newNormatives);
        batch.setUpdatedNormatives(updatedNormatives);
        batchRepo.save(batch);

        return new NormativeImportDtos.ImportPreviewResponse(
                batch.getId(), fileName, validRows + errorRows, validRows, errorRows,
                duplicates, newPollutants, newNormatives, updatedNormatives, errors, preview);
    }

    @Transactional
    public NormativeImportDtos.ImportConfirmResponse confirmImport(Long importId, MultipartFile file) throws IOException {
        ImportBatch batch = batchRepo.findById(importId)
                .orElseThrow(() -> new NotFoundException("Импорт не найден: " + importId));

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : batch.getFileName();
        NormativeImportDtos.ImportConfirmResponse result = importResource(file.getBytes(), fileName, batch.getId());

        batch.setStatus("CONFIRMED");
        batch.setConfirmedAt(LocalDateTime.now());
        batch.setNewNormatives(result.imported());
        batch.setUpdatedNormatives(result.updated());
        batchRepo.save(batch);
        return result;
    }

    @Transactional
    public void rollbackImport(Long importId) {
        ImportBatch batch = batchRepo.findById(importId)
                .orElseThrow(() -> new NotFoundException("Импорт не найден: " + importId));
        List<NormativeRecord> records = normativeRepo.findByImportBatchId(importId);
        for (NormativeRecord r : records) {
            r.setActive(false);
        }
        normativeRepo.saveAll(records);
        batch.setStatus("ROLLED_BACK");
        batchRepo.save(batch);
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
            NormativeRecord ex = existing.getFirst();
            if (ex.isActive() && valuesEqual(ex.getValue(), parsed.value())) {
                return null;
            }
            ex.setActive(false);
            normativeRepo.save(ex);

            NormativeRecord newVersion = buildRecord(parsed, mapping, pollutant, fileName, rowNum, batchId, manifestEntry);
            newVersion.setVersion(ex.getVersion() + 1);
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
