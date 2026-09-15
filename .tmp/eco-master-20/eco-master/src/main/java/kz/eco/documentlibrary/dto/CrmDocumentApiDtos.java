package kz.eco.documentlibrary.dto;

import kz.eco.documentlibrary.CrmDocumentCategory;

import java.time.LocalDate;
import java.util.List;

/** Request/response records for /api/staff/documents. Response DTOs never expose
 *  {@code fileId} or any filesystem/storage path - only the opaque document id, metadata, and a
 *  {@code downloadUrl} pointing back at this same API. Field names match the frontend contract
 *  exactly (name/originalFileName/uploadedAt/uploadedBy{id,fullName}/canDelete/availableActions) -
 *  do not rename these without updating the frontend at the same time. */
public final class CrmDocumentApiDtos {

    private CrmDocumentApiDtos() {
    }

    public record UploadedByResponse(Long id, String fullName) {}

    public record CrmDocumentResponse(
            Long id,
            String name,
            String category,
            String comment,
            String originalFileName,
            String mimeType,
            long fileSize,
            String uploadedAt,
            UploadedByResponse uploadedBy,
            String downloadUrl,
            boolean canDelete,
            List<String> availableActions,
            long version
    ) {}

    public record CategoryOption(CrmDocumentCategory value, String label) {}

    /** Partial-update body: every field is optional EXCEPT {@code version}, which is required for
     *  the optimistic-lock check. Omitted (null) fields keep their existing stored value. */
    public record UpdateRequest(
            String name,
            String category,
            String comment,
            LocalDate documentDate,
            Long version
    ) {}
}
