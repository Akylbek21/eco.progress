package kz.eco.normative.dsm138.dto;

import java.util.List;

public final class Dsm138ImportDtos {

    private Dsm138ImportDtos() {
    }

    public record FilePreview(String fileName, Integer appendixNo, Integer tableNo,
                               String categoryCode, int recordCount, List<String> errors) {
    }

    public record PreviewResponse(int totalFiles, int totalRecords, List<FilePreview> files, List<String> warnings) {
    }

    public record ConfirmResponse(Long importBatchId, int totalFiles, int totalRows,
                                   int created, int updated, List<String> warnings) {
    }
}
