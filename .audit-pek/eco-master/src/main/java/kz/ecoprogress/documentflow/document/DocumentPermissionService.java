package kz.ecoprogress.documentflow.document;

import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import kz.ecoprogress.documentflow.revocation.RevocationRequest;
import kz.ecoprogress.documentflow.revocation.RevocationRequestRepository;
import kz.ecoprogress.documentflow.revocation.RevocationStatus;
import kz.ecoprogress.documentflow.signing.AssignmentStatus;
import kz.ecoprogress.documentflow.signing.SigningAssignment;
import kz.ecoprogress.documentflow.signing.SigningAssignmentRepository;
import kz.ecoprogress.documentflow.signing.SigningRoute;
import kz.ecoprogress.documentflow.signing.SigningRouteRepository;
import kz.ecoprogress.documentflow.signing.SigningRouteStatus;
import kz.ecoprogress.documentflow.signing.SigningStep;
import kz.ecoprogress.documentflow.signing.SigningStepRepository;
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
    private final SigningRouteRepository signingRouteRepository;
    private final SigningStepRepository signingStepRepository;
    private final SigningAssignmentRepository signingAssignmentRepository;
    private final RevocationRequestRepository revocationRequestRepository;

    public DocumentPermissionService(DocumentFlowAccessService accessService,
                                      SigningRouteRepository signingRouteRepository,
                                      SigningStepRepository signingStepRepository,
                                      SigningAssignmentRepository signingAssignmentRepository,
                                      RevocationRequestRepository revocationRequestRepository) {
        this.accessService = accessService;
        this.signingRouteRepository = signingRouteRepository;
        this.signingStepRepository = signingStepRepository;
        this.signingAssignmentRepository = signingAssignmentRepository;
        this.revocationRequestRepository = revocationRequestRepository;
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

    /**
     * Module spec §9: the coarse, status-only {@link #availableActions} above is kept as-is for
     * the list endpoint (batch-friendly, no per-row assignment/revocation lookups - see
     * DocumentService#toListItemDtos). This is the single-document variant used by the detail
     * endpoint, which can afford the extra lookups and adds everything that depends on the
     * CURRENT USER's own signing assignment and the document's revocation-request state - both
     * were completely invisible to the old status-only computation (spec's core complaint: SIGN/
     * REJECT/RETURN_FOR_REVISION/revocation actions never appeared at all).
     */
    public List<String> detailedAvailableActions(Document document, Long userId, Long organizationId,
                                                  DocumentDtos.DocumentPermissions permissions) {
        List<String> actions = new ArrayList<>(availableActions(permissions));

        boolean canSignPermission = accessService.hasPermission(userId, organizationId, DocumentFlowPermission.SIGN_DOCUMENT);
        if (canSignPermission) {
            signingRouteRepository.findFirstByDocumentIdAndStatus(document.getId(), SigningRouteStatus.ACTIVE)
                    .ifPresent(route -> {
                        List<Long> stepIds = signingStepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId())
                                .stream().map(SigningStep::getId).toList();
                        signingAssignmentRepository.findAllByStepIdIn(stepIds).stream()
                                .filter(a -> userId.equals(a.getUserId()))
                                .filter(a -> a.getStatus() == AssignmentStatus.AVAILABLE || a.getStatus() == AssignmentStatus.VIEWED)
                                .findFirst()
                                .ifPresent(a -> {
                                    actions.add("SIGN");
                                    actions.add("REJECT");
                                    actions.add("RETURN_FOR_REVISION");
                                });
                    });
        }

        boolean canDownloadSignedPackage = document.getStatus() == DocumentStatus.SIGNED
                || document.getStatus() == DocumentStatus.PARTIALLY_SIGNED
                || document.getStatus() == DocumentStatus.REVOKED;
        if (canDownloadSignedPackage
                && accessService.hasPermission(userId, organizationId, DocumentFlowPermission.VIEW_DOCUMENTS)) {
            actions.add("DOWNLOAD_SIGNED_PACKAGE");
        }

        if (accessService.hasPermission(userId, organizationId, DocumentFlowPermission.VIEW_AUDIT_LOG)) {
            actions.add("VIEW_AUDIT");
        }
        if (permissions.canDownload()) {
            actions.add("DOWNLOAD_ATTACHMENT");
        }

        // Revocation actions (module spec §9/§19): this module's RevocationService has no
        // requester/counterparty "side" distinction - approve/reject/cancel are all gated purely
        // on REVOKE_SIGNATURE within the document's own organization, so the action set only needs
        // the latest request's status, not "who requested it".
        if (accessService.hasPermission(userId, organizationId, DocumentFlowPermission.REVOKE_SIGNATURE)) {
            List<RevocationRequest> history = revocationRequestRepository.findAllByDocumentIdOrderByCreatedAtDesc(document.getId());
            RevocationRequest latest = history.isEmpty() ? null : history.get(0);
            boolean hasOpenRequest = latest != null && (latest.getStatus() == RevocationStatus.DRAFT
                    || latest.getStatus() == RevocationStatus.SENT || latest.getStatus() == RevocationStatus.PENDING);
            if (document.getStatus() == DocumentStatus.SIGNED && !hasOpenRequest) {
                actions.add("CREATE_REVOCATION");
            }
            if (latest != null && (latest.getStatus() == RevocationStatus.PENDING || latest.getStatus() == RevocationStatus.SENT)) {
                actions.add("APPROVE_REVOCATION");
                actions.add("REJECT_REVOCATION");
            }
            if (latest != null && (latest.getStatus() == RevocationStatus.DRAFT
                    || latest.getStatus() == RevocationStatus.SENT || latest.getStatus() == RevocationStatus.PENDING)) {
                actions.add("CANCEL_REVOCATION");
            }
        }

        return actions;
    }
}
