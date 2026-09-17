package kz.eco.normative.dto;

import java.util.ArrayList;
import java.util.List;

public record PhysicalFactorImportResult(
        String sourceDocumentCode,
        int processedFiles,
        int skippedFiles,
        int created,
        int updated,
        List<String> warnings
) {
    public static PhysicalFactorImportResult empty() {
        return new PhysicalFactorImportResult("DSM_15", 0, 0, 0, 0, List.of());
    }

    public PhysicalFactorImportResult withWarning(String warning) {
        List<String> next = new ArrayList<>(warnings != null ? warnings : List.of());
        next.add(warning);
        return new PhysicalFactorImportResult(sourceDocumentCode, processedFiles, skippedFiles, created, updated, List.copyOf(next));
    }
}
