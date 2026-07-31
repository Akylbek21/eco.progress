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
     *  only prepares and sends a protocol to approval. */
    private static final Set<UserRole> SUPERVISOR_ROLES = EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD);

    /** ADMIN/DIRECTOR/HEAD/LABORATORY - matches SecurityExpressions.LAB_PROTOCOL, the class-level
     *  gate on ProtocolController (view, create, edit, calculate, check-normatives, preview). */
    private static final Set<UserRole> LAB_PROTOCOL_ROLES =
            EnumSet.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.LABORATORY);

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
        if (currentUser == null || !LAB_PROTOCOL_ROLES.contains(currentUser.getRole())) {
            return ProtocolApiDtos.ProtocolPermissions.none();
        }
        ProtocolStatus status = protocol.getStatus();
        boolean supervisor = SUPERVISOR_ROLES.contains(currentUser.getRole());
        boolean admin = currentUser.getRole() == UserRole.ADMIN;
        boolean editable = status.isEditable();
        // Publishing to the client closes the signature-collection window (spec: "После публикации
        // дополнительные подписи запрещены") - further signers would change what already went out.
        boolean canSign = (status == ProtocolStatus.APPROVED || status == ProtocolStatus.SIGNED)
                && protocol.getPublishedAt() == null
                && supervisor && !alreadySignedByCurrentUser && signatureCount < signingProperties.getMaxSignatures();

        boolean canPublish = status == ProtocolStatus.SIGNED && protocol.getPublishedAt() == null && supervisor;
        boolean canCreateCorrection = (status == ProtocolStatus.SIGNED || status == ProtocolStatus.REPLACED) && supervisor;

        return new ProtocolApiDtos.ProtocolPermissions(
                /* canView              */ true,
                /* canEdit              */ editable,
                /* canDelete            */ admin && status == ProtocolStatus.DRAFT,
                /* canCalculate         */ editable,
                /* canCheckNormatives   */ editable,
                /* canGeneratePreview   */ editable,
                /* canSendToApproval    */ status.canTransitionTo(ProtocolStatus.READY_FOR_APPROVAL),
                /* canReturnForRevision */ status == ProtocolStatus.READY_FOR_APPROVAL && supervisor,
                /* canApprove           */ status == ProtocolStatus.READY_FOR_APPROVAL && supervisor,
                /* canSign              */ canSign,
                /* canCreateCorrection  */ canCreateCorrection,
                /* canCancel            */ status.canTransitionTo(ProtocolStatus.CANCELLED) && supervisor,
                /* canArchive           */ status.canTransitionTo(ProtocolStatus.ARCHIVED) && supervisor,
                /* canPublish           */ canPublish
        );
    }
}
