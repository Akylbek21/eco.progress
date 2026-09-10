package kz.eco.normative.dsm32;

import kz.eco.normative.ImportBatch;
import kz.eco.normative.ImportBatchRepository;
import kz.eco.normative.NormativeRecord;
import kz.eco.normative.SourceDocumentCode;
import kz.eco.normative.dto.Dsm32ImportResult;
import kz.eco.normative.physical.PhysicalFactorHtmlTableReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class Dsm32EnvironmentSafetyImportService {

    private static final Logger log = LoggerFactory.getLogger(Dsm32EnvironmentSafetyImportService.class);

    private static final String PRIMARY_MANIFEST_FOLDER = "dsm32/";
    private static final String PRIMARY_DATA_FOLDER = "dsm32/dsm32_1/";
    private static final String FALLBACK_FOLDER = "xls/dsm-32-environment-safety/";
    private static final String MANIFEST_FILE = "DSM_32_environment_safety_manifest.csv";

    private final Dsm32ParserRegistry parserRegistry;
    private final Dsm32NormativeUpserter upserter;
    private final ImportBatchRepository importBatchRepository;

    public Dsm32EnvironmentSafetyImportService(Dsm32ParserRegistry parserRegistry,
                                               Dsm32NormativeUpserter upserter,
                                               ImportBatchRepository importBatchRepository) {
        this.parserRegistry = parserRegistry;
        this.upserter = upserter;
        this.importBatchRepository = importBatchRepository;
    }

    /** Startup/seeder path - no authenticated user to attribute the batch to. */
    @Transactional
    public Dsm32ImportResult importResources() throws IOException {
        return importResources(null);
    }

    /** Audited path: creates an {@link ImportBatch} (source, user, timestamp) up front and stamps
     *  its id on every created/updated record, mirroring the DSM-138 preview/confirm pattern so
     *  this resource import is traceable the same way. */
    @Transactional
    public Dsm32ImportResult importResources(Long userId) throws IOException {
        ResourcePaths paths = resolveResourcePaths();
        ClassPathResource manifestResource = new ClassPathResource(paths.manifestPath());
        if (!manifestResource.exists()) {
            log.warn("DSM-32 manifest not found at classpath:{}", paths.manifestPath());
            return Dsm32ImportResult.empty();
        }

        ImportBatch batch = new ImportBatch();
        batch.setFileName("dsm32-resources");
        batch.setUserId(userId);
        batch.setStatus("CONFIRMED");
        batch = importBatchRepository.save(batch);

        List<ManifestRow> manifestRows = readManifest(manifestResource.getInputStream());
        int processedFiles = 0;
        int created = 0;
        int updated = 0;
        List<String> warnings = new ArrayList<>();

        for (ManifestRow row : manifestRows) {
            if (row.newFile() == null || row.newFile().isBlank()) {
                continue;
            }
            if (row.status() != null && row.status().toUpperCase().contains("SKIP")) {
                continue;
            }

            ClassPathResource fileResource = new ClassPathResource(paths.dataFolder() + row.newFile());
            if (!fileResource.exists()) {
                warnings.add("Файл не найден: " + row.newFile());
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

        return new Dsm32ImportResult(
                SourceDocumentCode.DSM_32.name(),
                processedFiles,
                created,
                updated,
                List.copyOf(warnings));
    }

    @Transactional
    FileImportStats importFile(InputStream inputStream, ManifestRow manifestRow) throws IOException {
        return importFile(inputStream, manifestRow, null);
    }

    @Transactional
    FileImportStats importFile(InputStream inputStream, ManifestRow manifestRow, Long importBatchId) throws IOException {
        Dsm32ImportContext context = new Dsm32ImportContext(
                manifestRow.newFile(),
                manifestRow.parserType(),
                manifestRow.tableNo() != null ? manifestRow.tableNo() : 0,
                Dsm32ImportContext.DOCUMENT_DATE);

        List<List<String>> rows = PhysicalFactorHtmlTableReader.readRows(inputStream);
        if (rows.isEmpty()) {
            return new FileImportStats(0, 0, List.of("Пустая таблица: " + manifestRow.newFile()));
        }

        var parser = parserRegistry.find(manifestRow.parserType());
        if (parser.isEmpty()) {
            String preview = summarizeRows(rows);
            log.warn("Parser not implemented for {} in file {}. Raw preview: {}",
                    manifestRow.parserType(), manifestRow.newFile(), preview);
            return new FileImportStats(0, 0, List.of(
                    "Парсер не реализован (" + manifestRow.parserType() + "): " + manifestRow.newFile()));
        }

        List<NormativeRecord> parsed = parser.get().parse(context, rows);
        int created = 0;
        int updated = 0;
        for (NormativeRecord record : parsed) {
            Dsm32NormativeUpserter.UpsertResult result = upserter.upsert(context, record, importBatchId);
            switch (result.action()) {
                case CREATED -> created++;
                case UPDATED -> updated++;
                case UNCHANGED -> {
                }
            }
        }
        return new FileImportStats(created, updated, List.of());
    }

    private static ResourcePaths resolveResourcePaths() {
        if (new ClassPathResource(PRIMARY_MANIFEST_FOLDER + MANIFEST_FILE).exists()) {
            return new ResourcePaths(PRIMARY_MANIFEST_FOLDER + MANIFEST_FILE, PRIMARY_DATA_FOLDER);
        }
        return new ResourcePaths(FALLBACK_FOLDER + MANIFEST_FILE, FALLBACK_FOLDER);
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
                if (parts.size() < 7) {
                    continue;
                }
                rows.add(new ManifestRow(
                        parts.get(0),
                        parts.get(1),
                        parts.get(2),
                        parts.get(3),
                        parts.get(4),
                        parseInt(parts.get(5)),
                        parts.get(6),
                        parts.size() > 7 ? parts.get(7) : null,
                        parts.size() > 8 ? parts.get(8) : null,
                        parts.size() > 9 ? parts.get(9) : null));
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

    record ResourcePaths(String manifestPath, String dataFolder) {
    }

    record ManifestRow(
            String originalFile,
            String newFile,
            String sourceDocumentCode,
            String templateId,
            String environmentType,
            Integer tableNo,
            String parserType,
            String title,
            String status,
            String comment
    ) {
    }

    record FileImportStats(int created, int updated, List<String> warnings) {
    }
}
