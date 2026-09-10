package kz.eco.protocol;

import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Set;

/**
 * Single source of truth for "what can the current user do to this protocol right now" -
 * mirrors the @PreAuthorize roles actually enforced on ProtocolController (LAB_PROTOCOL vs
 * PROTOCOL_SUPERVISOR vs ADMIN_ONLY, see SecurityExpressions) combined with the status
 * transition table in ProtocolStatus, so the two never drift apart. The frontend renders
 * available actions from ProtocolResponse.permissions() instead of re-deriving this logic from
 * role + status itself.
 */
@Component
public class ProtocolPermissionService {

    /** ADMIN/DIRECTOR/HEAD - matches SecurityExpressions.PROTOCOL_SUPERVISOR exactly (return for
     *  revision, approve, sign, correction, cancel, archive, publish). LABORATORY is excluded: it
     *  only prepares and sends a protocol to approval.
     *  Public: ProtocolService.sign() enforces the exact same set server-side (module fix - closing
     *  the sign bypass where only the controller's broader LAB_PROTOCOL gate applied). */
    public static final Set<UserRole> SUPERVISOR_ROLES = EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD);

    /** ADMIN/DIRECTOR/HEAD/LABORATORY - matches SecurityExpressions.LAB_PROTOCOL, the class-level
     *  gate on ProtocolController (create, edit, calculate, check-normatives, preview). */
    public static final Set<UserRole> LAB_PROTOCOL_ROLES =
            EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.LABORATORY);

    /** Module spec §3: matches SecurityExpressions.PROTOCOL_VIEW - LAB_PROTOCOL_ROLES plus the
     *  read-only roles (MANAGER/ACCOUNTANT/ECOLOGIST/WASTE_SPECIALIST). Everything except canView
     *  stays false for a user who is only in this wider set. Package-visible (not private): also
     *  used by {@link ProtocolAccessService#resolveScope} as the "does this role even use the
     *  protocol section at all" gate before resolving per-protocol scope. */
    static final Set<UserRole> PROTOCOL_VIEW_ROLES = EnumSet.of(
            UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.LABORATORY,
            UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ECOLOGIST, UserRole.WASTE_SPECIALIST);

    private final ProtocolSigningProperties signingProperties;

    public ProtocolPermissionService(ProtocolSigningProperties signingProperties) {
        this.signingProperties = signingProperties;
    }

    public ProtocolApiDtos.ProtocolPermissions calculate(Protocol protocol, User currentUser) {
        return calculate(protocol, currentUser, 0, false);
    }

    /** @param signatureCount current protocol_signatures row count for protocol.getVersion()
     *  @param alreadySignedByCurrentUser whether currentUser already has a row for that version */
    public ProtocolApiDtos.ProtocolPermissions calculate(Protocol protocol, User currentUser,
                                                          int signatureCount, boolean alreadySignedByCurrentUser) {
        if (currentUser == null || !PROTOCOL_VIEW_ROLES.contains(currentUser.getRole())) {
            return ProtocolApiDtos.ProtocolPermissions.none();
        }
        if (!LAB_PROTOCOL_ROLES.contains(currentUser.getRole())) {
            // Read-only role (spec §3 PROTOCOL_VIEW): can see the protocol and its audit trail,
            // nothing else - GET /{id}/audit shares the same PROTOCOL_VIEW gate as GET /{id}.
            return new ProtocolApiDtos.ProtocolPermissions(
                    /* canView */ true, false, false, false, false, false,
                    false, false, false, false, false, false, false, false, false,
                    false, false, false, false, false, false, /* canViewAudit */ true);
        }
        ProtocolStatus status = protocol.getStatus();
        boolean supervisor = SUPERVISOR_ROLES.contains(currentUser.getRole());
        boolean editable = status.isEditable();
        // Publishing to the client closes the signature-collection window (spec: "После публикации
        // дополнительные подписи запрещены") - further signers would change what already went out.
        // Module fix item 5: the READY-based "lab executor signs without approval" shortcut is
        // retired along with the READY status itself - signing now always requires the formal
        // APPROVED review path, supervisor-only, matching sign()'s own transition/role checks.
        boolean canSign = protocol.getPublishedAt() == null
                && !alreadySignedByCurrentUser && signatureCount < signingProperties.getMaxSignatures()
                && (status == ProtocolStatus.APPROVED || status == ProtocolStatus.SIGNED) && supervisor;

        boolean canPublish = status == ProtocolStatus.SIGNED && protocol.getPublishedAt() == null && supervisor;
        boolean canCreateCorrection = status == ProtocolStatus.SIGNED && supervisor;
        // Module fix item 1: generateDocuments/regenerateDocuments were ambiguous about which
        // format - split into four explicit actions, each also considering document state (does
        // the file already exist) so the frontend can distinguish "generate" from "regenerate"
        // instead of guessing from hasDocx/hasPdf itself. Module fix item 7: gated on `editable`
        // (not the older, broader !isGenerationBlocked()) so APPROVED is excluded - a user must
        // returnToDraft() before touching an approved protocol's documents at all.
        boolean hasDocx = protocol.getDocxFileId() != null;
        boolean hasPdf = protocol.getPdfFileId() != null;
        boolean canReturnToDraft = status.canTransitionTo(ProtocolStatus.DRAFT) && supervisor;

        return new ProtocolApiDtos.ProtocolPermissions(
                /* canView              */ true,
                /* canEdit              */ editable,
                /* canDelete            */ protocol.isDeletable()
                        && (supervisor || status != ProtocolStatus.READY_FOR_APPROVAL),
                /* canCalculate         */ editable,
                /* canCheckNormatives   */ editable,
                /* canGeneratePreview   */ editable || hasPdf,
                /* canSendToApproval    */ status.canTransitionTo(ProtocolStatus.READY_FOR_APPROVAL),
                /* canReturnForRevision */ status == ProtocolStatus.READY_FOR_APPROVAL && supervisor,
                /* canReturnToDraft     */ canReturnToDraft,
                /* canApprove           */ status == ProtocolStatus.READY_FOR_APPROVAL && supervisor,
                /* canSign              */ canSign,
                /* canCreateCorrection  */ canCreateCorrection,
                /* canCancel            */ status.canTransitionTo(ProtocolStatus.CANCELLED) && supervisor,
                /* canArchive           */ status.canTransitionTo(ProtocolStatus.ARCHIVED) && supervisor,
                /* canPublish           */ canPublish,
                /* canGenerateDocx      */ editable && !hasDocx,
                /* canGeneratePdf       */ editable && !hasPdf,
                /* canRegenerateDocx    */ editable && hasDocx,
                /* canRegeneratePdf     */ editable && hasPdf,
                // downloadDocx/downloadPdf never actually 404/403 on a missing stored file - both
                // /download-docx and /download/docx (see ProtocolService#downloadDocx/
                // #downloadDocxRendered) fall back to an on-demand render when docxFileId/
                // pdfFileId is null, so availability only depends on role/scope (already gated
                // above), not document state.
                /* canDownloadDocx      */ hasDocx || editable,
                /* canDownloadPdf       */ hasPdf || editable,
                /* canViewAudit         */ true
        );
    }
}
