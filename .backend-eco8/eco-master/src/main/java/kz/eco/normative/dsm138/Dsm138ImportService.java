package kz.eco.normative.dsm138;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.normative.ImportBatch;
import kz.eco.normative.ImportBatchRepository;
import kz.eco.normative.NormativeRecord;
import kz.eco.normative.NormativeRecordRepository;
import kz.eco.normative.dsm138.dto.Dsm138ImportDtos;
import kz.eco.normative.physical.PhysicalFactorHtmlTableReader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Preview/confirm/rollback pipeline for DSM_138 (water normatives), uploaded as either a ZIP
 * (DSM_138_water_normatives_renamed.zip) or a plain list of .xls files. Preview never touches the
 * database; confirm parses the same way and persists through Dsm138NormativeUpserter, recording
 * an ImportBatch so rollback can deactivate exactly what this import created/touched. A missing
 * appendix (e.g. appendix 3, not shipped in the zip) is not an error - whatever files are present
 * are simply the ones processed.
 */
@Service
public class Dsm138ImportService {

    private static final LocalDate DOCUMENT_DATE = LocalDate.of(2022, 11, 24);

    private final Dsm138NormativeUpserter upserter;
    private final ImportBatchRepository importBatchRepository;
    private final NormativeRecordRepository normativeRecordRepository;

    public Dsm138ImportService(Dsm138NormativeUpserter upserter,
                               ImportBatchRepository importBatchRepository,
                               NormativeRecordRepository normativeRecordRepository) {
        this.upserter = upserter;
        this.importBatchRepository = importBatchRepository;
        this.normativeRecordRepository = normativeRecordRepository;
    }

    public Dsm138ImportDtos.PreviewResponse preview(List<MultipartFile> files) throws IOException {
        Map<String, byte[]> extracted = extractXlsFiles(files);
        List<Dsm138ImportDtos.FilePreview> filePreviews = new ArrayList<>();
        int totalRecords = 0;
        List<String> warnings = new ArrayList<>();

        for (Map.Entry<String, byte[]> entry : extracted.entrySet()) {
            String fileName = entry.getKey();
            Dsm138FileMapping mapping = Dsm138FileMapping.fromFileName(fileName);
            if (mapping == null) {
                warnings.add("Файл не распознан (пропущен): " + fileName);
                continue;
            }
            Dsm138TableParser.ParseResult result = parseFile(fileName, entry.getValue(), mapping);
            totalRecords += result.records().size();
            filePreviews.add(new Dsm138ImportDtos.FilePreview(
                    fileName, mapping.appendixNo(), mapping.tableNo(), mapping.category().name(),
                    result.records().size(), result.warnings()));
            warnings.addAll(result.warnings());
        }

        if (filePreviews.isEmpty()) {
            warnings.add("Не найдено ни одного распознанного файла DSM_138");
        }
        return new Dsm138ImportDtos.PreviewResponse(filePreviews.size(), totalRecords, filePreviews, warnings);
    }

    @Transactional
    public Dsm138ImportDtos.ConfirmResponse confirm(List<MultipartFile> files, Long userId) throws IOException {
        Map<String, byte[]> extracted = extractXlsFiles(files);
        return confirmFiles(extracted, summarizeFileNames(files), userId);
    }

    /**
     * Same persistence path as {@link #confirm}, for files already in memory (bundled classpath
     * resources at startup) instead of an HTTP multipart upload - see {@link Dsm138ResourceSeeder}.
     */
    @Transactional
    public Dsm138ImportDtos.ConfirmResponse confirmFiles(Map<String, byte[]> files, Long userId) throws IOException {
        return confirmFiles(files, "dsm-water (classpath)", userId);
    }

    private Dsm138ImportDtos.ConfirmResponse confirmFiles(Map<String, byte[]> extracted, String batchLabel, Long userId) throws IOException {
        if (extracted.isEmpty()) {
            throw new BadRequestException("Не найдено ни одного файла DSM_138 для импорта");
        }

        ImportBatch batch = new ImportBatch();
        batch.setFileName(batchLabel);
        batch.setUserId(userId);
        batch.setStatus("CONFIRMED");
        batch = importBatchRepository.save(batch);

        int created = 0;
        int updated = 0;
        int totalRows = 0;
        List<String> warnings = new ArrayList<>();

        for (Map.Entry<String, byte[]> entry : extracted.entrySet()) {
            String fileName = entry.getKey();
            Dsm138FileMapping mapping = Dsm138FileMapping.fromFileName(fileName);
            if (mapping == null) {
                warnings.add("Файл не распознан (пропущен): " + fileName);
                continue;
            }
            Dsm138TableParser.ParseResult result = parseFile(fileName, entry.getValue(), mapping);
            warnings.addAll(result.warnings());
            for (NormativeRecord record : result.records()) {
                totalRows++;
                Dsm138NormativeUpserter.UpsertResult upsertResult = upserter.upsert(record, batch.getId());
                if (upsertResult.action() == Dsm138NormativeUpserter.Action.CREATED) {
                    created++;
                } else {
                    updated++;
                }
            }
        }

        batch.setTotalRows(totalRows);
        batch.setValidRows(totalRows);
        batch.setNewNormatives(created);
        batch.setUpdatedNormatives(updated);
        batch.setConfirmedAt(LocalDateTime.now());
        importBatchRepository.save(batch);

        return new Dsm138ImportDtos.ConfirmResponse(batch.getId(), extracted.size(), totalRows, created, updated, warnings);
    }

    @Transactional
    public void rollback(Long importBatchId) {
        ImportBatch batch = importBatchRepository.findById(importBatchId)
                .orElseThrow(() -> new NotFoundException("Импорт не найден: " + importBatchId));
        List<NormativeRecord> records = normativeRecordRepository.findByImportBatchId(importBatchId);
        for (NormativeRecord record : records) {
            record.setActive(false);
        }
        normativeRecordRepository.saveAll(records);
        batch.setStatus("ROLLED_BACK");
        importBatchRepository.save(batch);
    }

    private Dsm138TableParser.ParseResult parseFile(String fileName, byte[] content, Dsm138FileMapping mapping) throws IOException {
        List<List<String>> rows = PhysicalFactorHtmlTableReader.readRows(new ByteArrayInputStream(content));
        return Dsm138TableParser.parse(rows, mapping, fileName, DOCUMENT_DATE);
    }

    /** Accepts one ZIP, several plain .xls files, or a mix of both; returns fileName -> raw bytes. */
    private Map<String, byte[]> extractXlsFiles(List<MultipartFile> files) throws IOException {
        Map<String, byte[]> result = new LinkedHashMap<>();
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Файлы не переданы");
        }
        for (MultipartFile file : files) {
            String name = file.getOriginalFilename();
            if (name != null && name.toLowerCase().endsWith(".zip")) {
                extractZip(file.getInputStream(), result);
            } else if (name != null && name.toLowerCase().endsWith(".xls")) {
                result.put(baseName(name), file.getBytes());
            }
        }
        return result;
    }

    private void extractZip(InputStream inputStream, Map<String, byte[]> result) throws IOException {
        try (ZipInputStream zip = new ZipInputStream(inputStream)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = baseName(entry.getName());
                if (!entry.isDirectory() && name.toLowerCase().endsWith(".xls")) {
                    result.put(name, zip.readAllBytes());
                }
                zip.closeEntry();
            }
        }
    }

    private String baseName(String path) {
        int slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
        return slash >= 0 ? path.substring(slash + 1) : path;
    }

    private String summarizeFileNames(List<MultipartFile> files) {
        StringBuilder builder = new StringBuilder();
        for (MultipartFile file : files) {
            if (!builder.isEmpty()) {
                builder.append(", ");
            }
            builder.append(file.getOriginalFilename());
        }
        return builder.length() > 200 ? builder.substring(0, 200) : builder.toString();
    }
}
