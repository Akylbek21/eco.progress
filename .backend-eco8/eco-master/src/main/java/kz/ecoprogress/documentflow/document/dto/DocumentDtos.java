package kz.ecoprogress.documentflow.document.dto;

import kz.ecoprogress.documentflow.document.DocumentDirection;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.document.DocumentType;

import java.time.LocalDateTime;
import java.util.Map;

public final class DocumentDtos {

    private DocumentDtos() {
    }

    public record CreateDocumentRequest(
            DocumentType documentType,
            DocumentDirection direction,
            String title,
            String description,
            Long counterpartyId,
            LocalDateTime signingDeadline,
            /** Only used to disambiguate which of the user's own organizations they mean when
             *  they belong to more than one - never trusted as-is for the access check. */
            Long organizationId
    ) {
    }

    public record UpdateDocumentRequest(
            String title,
            String description,
            String documentNumber,
            Long counterpartyId,
            LocalDateTime signingDeadline
    ) {
    }

    public record UserSummary(Long id, String fullName) {
    }

    public record CounterpartySummary(Long id, String name, String bin) {
    }

    public record DocumentPermissions(
            boolean canView,
            boolean canEdit,
            boolean canDelete,
            boolean canSend,
            boolean canDownload,
            boolean canUploadVersion,
            boolean canArchive,
            boolean canManageAttachments
    ) {
        public static DocumentPermissions none() {
            return new DocumentPermissions(false, false, false, false, false, false, false, false);
        }
    }

    public record DocumentListItemDto(
            Long id,
            String number,
            String title,
            DocumentType type,
            DocumentDirection direction,
            CounterpartySummary counterparty,
            UserSummary author,
            LocalDateTime createdAt,
            LocalDateTime deadline,
            DocumentStatus status,
            // TODO-RECONCILE: real values once Agent C's document_flow_signing_assignments /
            // signatures tables exist - both are 0/false until then.
            int signedCount,
            int requiredCount,
            boolean requiresMySignature,
            long version,
            DocumentPermissions permissions,
            java.util.List<String> availableActions
    ) {
    }

    public record DocumentDetailDto(
            Long id,
            String publicId,
            String number,
            String title,
            String description,
            DocumentType type,
            DocumentDirection direction,
            CounterpartySummary counterparty,
            UserSummary author,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            LocalDateTime deadline,
            DocumentStatus status,
            Long currentVersionId,
            long version,
            DocumentPermissions permissions,
            java.util.List<String> availableActions
    ) {
    }

    public record DashboardResponse(
            long total,
            Map<DocumentStatus, Long> byStatus,
            Map<DocumentDirection, Long> byDirection
    ) {
    }
}
