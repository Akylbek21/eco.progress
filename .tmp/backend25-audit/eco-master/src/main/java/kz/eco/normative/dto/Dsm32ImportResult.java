package kz.eco.normative.dto;

import kz.eco.normative.SourceDocumentCode;

import java.util.ArrayList;
import java.util.List;

public record Dsm32ImportResult(
        String sourceDocumentCode,
        int processedFiles,
        int created,
        int updated,
        List<String> warnings
) {
    public static Dsm32ImportResult empty() {
        return new Dsm32ImportResult(SourceDocumentCode.DSM_32.name(), 0, 0, 0, List.of());
    }

    public Dsm32ImportResult withWarning(String warning) {
        List<String> next = new ArrayList<>(warnings != null ? warnings : List.of());
        next.add(warning);
        return new Dsm32ImportResult(sourceDocumentCode, processedFiles, created, updated, List.copyOf(next));
    }
}
