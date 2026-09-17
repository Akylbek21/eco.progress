package kz.eco.normative.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

public class NormativeImportDtos {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ImportPreviewResponse(
            Long importId,
            String fileName,
            int totalRows,
            int validRows,
            int errorRows,
            int duplicates,
            int newPollutants,
            int newNormatives,
            int updatedNormatives,
            List<String> errors,
            List<ImportRowPreview> preview
    ) {}

    public record ImportRowPreview(
            int row,
            String pollutantCode,
            String pollutantName,
            String value,
            String unit,
            String hazardClass,
            String status
    ) {}

    public record ImportConfirmResponse(
            Long importId,
            int imported,
            int updated,
            int skipped,
            String message,
            String status
    ) {
        public ImportConfirmResponse(Long importId, int imported, int updated, int skipped, String message) {
            this(importId, imported, updated, skipped, message, null);
        }

        public ImportConfirmResponse withStatus(String newStatus) {
            return new ImportConfirmResponse(importId, imported, updated, skipped, message, newStatus);
        }
    }

    public record NormativeResolveResponse(
            String pollutantCode,
            String pollutantNameRu,
            String environmentType,
            String normativeType,
            String value,
            String unit,
            String comparisonType,
            String document,
            String hazardClass,
            String status
    ) {}

    /**
     * GET /api/normatives/imports/{importId}. status - PREVIEW | PROCESSING | COMPLETED | FAILED |
     * ROLLED_BACK (исторический CONFIRMED отдаётся как COMPLETED). createdCount/updatedCount/
     * skippedCount - результат confirm (до confirm - прогноз preview).
     */
    public record ImportStatusResponse(
            Long id,
            Long importId,
            String fileName,
            String status,
            String createdAt,
            Long createdBy,
            String createdByName,
            String confirmedAt,
            String rolledBackAt,
            Long rolledBackBy,
            int totalRows,
            int validRows,
            int duplicates,
            int createdCount,
            int updatedCount,
            int skippedCount,
            int errorCount,
            List<String> errors,
            boolean canConfirm,
            boolean canRollback
    ) {}
}
