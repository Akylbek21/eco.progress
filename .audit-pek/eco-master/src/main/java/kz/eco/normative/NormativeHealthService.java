package kz.eco.normative;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class NormativeHealthService {
    private final NormativeRecordRepository recordRepository;
    private final ImportBatchRepository importBatchRepository;
    private final NormativeSeederStatusHolder seederStatusHolder;

    public NormativeHealthService(NormativeRecordRepository recordRepository,
                                  ImportBatchRepository importBatchRepository,
                                  NormativeSeederStatusHolder seederStatusHolder) {
        this.recordRepository = recordRepository;
        this.importBatchRepository = importBatchRepository;
        this.seederStatusHolder = seederStatusHolder;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> health() {
        Map<String, Long> byTemplate = new LinkedHashMap<>();
        for (Object[] row : recordRepository.countActiveByTemplateType()) {
            String key = row[0] == null ? "UNSPECIFIED"
                    : ((TemplateType) row[0]).name().toLowerCase(java.util.Locale.ROOT);
            byTemplate.put(key, (Long) row[1]);
        }
        ImportBatch last = importBatchRepository.findTopByOrderByCreatedAtDesc().orElse(null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", recordRepository.count());
        result.put("active", recordRepository.countByActiveTrue());
        result.put("byTemplate", byTemplate);
        result.put("lastImportAt", last == null ? null
                : (last.getConfirmedAt() != null ? last.getConfirmedAt() : last.getCreatedAt()));
        result.put("lastImportStatus", last == null ? "NOT_AVAILABLE" : last.getStatus());
        // Startup resource seeder is a separate, best-effort path from admin-driven Excel imports
        // above (ImportBatch) - surfaced here so a silent seeding failure (previously only a log
        // line) is visible without an operator having to go find server logs.
        if (seederStatusHolder.isAnyAttempted()) {
            result.put("importSource", "STARTUP_SEEDER");
            result.put("importStatus", seederStatusHolder.hasFailures() ? "FAILED" : "OK");
            result.put("lastSeederRunAt", seederStatusHolder.lastRunAt());
            if (seederStatusHolder.hasFailures()) {
                result.put("importErrors", seederStatusHolder.failuresSnapshot());
            }
        } else {
            result.put("importSource", "STARTUP_SEEDER");
            result.put("importStatus", "NOT_AVAILABLE");
        }
        return result;
    }
}
