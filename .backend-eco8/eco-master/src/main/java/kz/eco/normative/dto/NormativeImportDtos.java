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
            String message
    ) {}

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

    public record ImportStatusResponse(
            Long id,
            String fileName,
            String status,
            int totalRows,
            int validRows,
            int errorRows,
            String createdAt,
            String confirmedAt
    ) {}
}
