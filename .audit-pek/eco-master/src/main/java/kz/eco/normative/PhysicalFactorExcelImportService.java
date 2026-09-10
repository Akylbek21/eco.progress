package kz.eco.normative;

import kz.eco.normative.dto.PhysicalFactorImportResult;
import kz.eco.normative.physical.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class PhysicalFactorExcelImportService {

    private static final Logger log = LoggerFactory.getLogger(PhysicalFactorExcelImportService.class);

    private static final String PRIMARY_FOLDER = "dsm/";
    private static final String FALLBACK_FOLDER = "xls/dsm-15-physical-factors/";
    private static final String MANIFEST_FILE = "DSM_15_physical_factors_renamed_manifest.csv";
    private static final LocalDate DOCUMENT_DATE = LocalDate.of(2022, 2, 16);

    private final PhysicalFactorParserRegistry parserRegistry;
    private final PhysicalFactorNormativeUpserter upserter;
    private final ImportBatchRepository importBatchRepository;

    public PhysicalFactorExcelImportService(PhysicalFactorParserRegistry parserRegistry,
                                            PhysicalFactorNormativeUpserter upserter,
                                            ImportBatchRepository importBatchRepository) {
        this.parserRegistry = parserRegistry;
        this.upserter = upserter;
        this.importBatchRepository = importBatchRepository;
    }

    @Transactional
    public int importFromClasspath() throws IOException {
        PhysicalFactorImportResult result = importResources();
        return result.created() + result.updated();
    }

    /** Startup/seeder path - no authenticated user to attribute the batch to. */
    @Transactional
    public PhysicalFactorImportResult importResources() throws IOException {
        return importResources(null);
    }

    /** Audited path: creates an {@link ImportBatch} (source, user, timestamp) up front and stamps
     *  its id on every created/updated record, mirroring the DSM-138 preview/confirm pattern so
     *  this resource import is traceable the same way. */
    @Transactional
    public PhysicalFactorImportResult importResources(Long userId) throws IOException {
        String folder = resolveResourceFolder();
        ClassPathResource manifestResource = new ClassPathResource(folder + MANIFEST_FILE);
        if (!manifestResource.exists()) {
            log.warn("DSM-15 manifest not found at classpath:{}{}", folder, MANIFEST_FILE);
            return PhysicalFactorImportResult.empty();
        }

        ImportBatch batch = new ImportBatch();
        batch.setFileName("physical-factors-resources");
        batch.setUserId(userId);
        batch.setStatus("CONFIRMED");
        batch = importBatchRepository.save(batch);

        List<ManifestRow> manifestRows = readManifest(manifestResource.getInputStream());
        int processedFiles = 0;
        int skippedFiles = 0;
        int created = 0;
        int updated = 0;
        List<String> warnings = new ArrayList<>();

        for (ManifestRow row : manifestRows) {
            if (row.factorType() != null && "OTHER_REVIEW".equalsIgnoreCase(row.factorType().trim())) {
                skippedFiles++;
                continue;
            }
            if (row.newFile() == null || row.newFile().isBlank()) {
                skippedFiles++;
                continue;
            }

            ClassPathResource fileResource = new ClassPathResource(folder + row.newFile());
            if (!fileResource.exists()) {
                warnings.add("Файл не найден: " + row.newFile());
                skippedFiles++;
                continue;
            }

            processedFiles++;
            FileImportStats stats = importFile(fileResource.getInputStream(), row, batch.getId());
            created += stats.created();
            updated += stats.updated();
            warnings.addAll(stats.warnings());
        }

        batch.setTotalRows(processedFiles);
        batch.setValidRows(processedFiles);
        batch.setNewNormatives(created);
        batch.setUpdatedNormatives(updated);
        batch.setConfirmedAt(LocalDateTime.now());
        importBatchRepository.save(batch);

        return new PhysicalFactorImportResult(
                SourceDocumentCode.DSM_15.name(),
                processedFiles,
                skippedFiles,
                created,
                updated,
                List.copyOf(warnings));
    }

    @Transactional
    public FileImportStats importFile(InputStream inputStream, ManifestRow manifestRow) throws IOException {
        return importFile(inputStream, manifestRow, null);
    }

    @Transactional
    public FileImportStats importFile(InputStream inputStream, ManifestRow manifestRow, Long importBatchId) throws IOException {
        String parserType = PhysicalFactorParserTypeResolver.resolve(
                manifestRow.factorType(), manifestRow.appendixNo(), manifestRow.tableNo(), manifestRow.newFile());

        PhysicalFactorImportContext context = new PhysicalFactorImportContext(
                manifestRow.newFile(),
                manifestRow.factorType(),
                parserType,
                manifestRow.appendixNo() != null ? manifestRow.appendixNo() : 0,
                manifestRow.tableNo() != null ? manifestRow.tableNo() : 0,
                SourceDocumentCode.DSM_15,
                DOCUMENT_DATE);

        List<List<String>> rows = PhysicalFactorHtmlTableReader.readRows(inputStream);
        if (rows.isEmpty()) {
            return new FileImportStats(0, 0, List.of("Пустая таблица: " + manifestRow.newFile()));
        }

        var parser = parserRegistry.find(parserType);
        if (parser.isEmpty()) {
            parser = parserRegistry.findGeneric();
        }
        if (parser.isEmpty()) {
            String preview = summarizeRows(rows);
            log.warn("No parser available for {} in file {}. Raw preview: {}",
                    parserType, manifestRow.newFile(), preview);
            return new FileImportStats(0, 0, List.of(
                    "Парсер не найден (" + parserType + "): " + manifestRow.newFile() + ". " + preview));
        }

        List<NormativeRecord> parsed = parser.get().parse(context, rows);
        int created = 0;
        int updated = 0;
        for (NormativeRecord record : parsed) {
            PhysicalFactorNormativeUpserter.UpsertResult result = upserter.upsert(context, record, importBatchId);
            switch (result.action()) {
                case CREATED -> created++;
                case UPDATED -> updated++;
                case UNCHANGED -> {
                }
            }
        }
        return new FileImportStats(created, updated, List.of());
    }

    private static String resolveResourceFolder() {
        if (new ClassPathResource(PRIMARY_FOLDER + MANIFEST_FILE).exists()) {
            return PRIMARY_FOLDER;
        }
        return FALLBACK_FOLDER;
    }

    private static List<ManifestRow> readManifest(InputStream inputStream) throws IOException {
        List<ManifestRow> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line = reader.readLine();
            if (line == null) {
                return rows;
            }
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> parts = parseCsvLine(line);
                if (parts.size() < 6) {
                    continue;
                }
                rows.add(new ManifestRow(
                        parts.get(0),
                        parts.get(1),
                        parts.get(2),
                        parseInt(parts.get(3)),
                        parseInt(parts.get(4)),
                        parts.size() > 5 ? parts.get(5) : null));
            }
        }
        return rows;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> parts = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                inQuotes = !inQuotes;
                continue;
            }
            if (ch == ',' && !inQuotes) {
                parts.add(current.toString().trim());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        parts.add(current.toString().trim());
        return parts;
    }

    private static Integer parseInt(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String summarizeRows(List<List<String>> rows) {
        int limit = Math.min(rows.size(), 3);
        StringBuilder builder = new StringBuilder("Строк: ").append(rows.size()).append(". Превью: ");
        for (int i = 0; i < limit; i++) {
            if (i > 0) {
                builder.append(" | ");
            }
            builder.append(String.join("; ", rows.get(i)));
        }
        return builder.toString();
    }

    public record ManifestRow(
            String originalFile,
            String newFile,
            String factorType,
            Integer appendixNo,
            Integer tableNo,
            String comment
    ) {
    }

    public record FileImportStats(int created, int updated, List<String> warnings) {
    }
}
