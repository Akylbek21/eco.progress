package kz.ecoprogress.documentflow.document;

import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Single source of truth for "what can the current user do to this document right now" - mirrors
 * kz.eco.protocol.ProtocolPermissionService: combines the DocumentStatus transition table with the
 * access service's permission grants, so the frontend renders available actions from
 * DocumentListItemDto/DocumentDetailDto.permissions()/availableActions() instead of re-deriving
 * role+status logic itself.
 */
@Component
public class DocumentPermissionService {

    private final DocumentFlowAccessService accessService;

    public DocumentPermissionService(DocumentFlowAccessService accessService) {
        this.accessService = accessService;
    }

    public DocumentDtos.DocumentPermissions calculate(Document document, Long userId, Long organizationId) {
        if (!accessService.hasPermission(userId, organizationId, DocumentFlowPermission.VIEW_DOCUMENTS)) {
            return DocumentDtos.DocumentPermissions.none();
        }
        DocumentStatus status = document.getStatus();
        boolean editable = status.isEditable();

        // The canonical DocumentFlowPermission enum (kz.ecoprogress.documentflow.access) is
        // coarser than this method originally assumed (no separate SEND/CREATE_VERSION/ARCHIVE
        // permissions) - EDIT_DOCUMENT covers every in-flight mutation, DELETE_DOCUMENT covers
        // both draft deletion and archiving (both are "retire this document" actions).
        boolean canEdit = editable
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.EDIT_DOCUMENT);
        boolean canDelete = status == DocumentStatus.DRAFT
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.DELETE_DOCUMENT);
        boolean canSend = status.canTransitionTo(DocumentStatus.SENT_FOR_SIGNING)
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.EDIT_DOCUMENT);
        boolean canDownload = document.getCurrentVersionId() != null
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.VIEW_DOCUMENTS);
        boolean canUploadVersion = editable
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.EDIT_DOCUMENT);
        boolean canArchive = status.canTransitionTo(DocumentStatus.ARCHIVED)
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.DELETE_DOCUMENT);
        boolean canManageAttachments = editable
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.EDIT_DOCUMENT);

        return new DocumentDtos.DocumentPermissions(
                true, canEdit, canDelete, canSend, canDownload, canUploadVersion, canArchive, canManageAttachments);
    }

    public List<String> availableActions(DocumentDtos.DocumentPermissions permissions) {
        List<String> actions = new ArrayList<>();
        if (permissions.canEdit()) actions.add("EDIT");
        if (permissions.canDelete()) actions.add("DELETE");
        if (permissions.canSend()) actions.add("SEND_FOR_SIGNING");
        if (permissions.canDownload()) actions.add("DOWNLOAD");
        if (permissions.canUploadVersion()) actions.add("UPLOAD_VERSION");
        if (permissions.canArchive()) actions.add("ARCHIVE");
        if (permissions.canManageAttachments()) actions.add("MANAGE_ATTACHMENTS");
        return actions;
    }
}
