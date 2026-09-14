package kz.eco.protocol;

import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Pure unit test (no Spring context) for the permission matrix - see ProtocolPermissionService. */
class ProtocolPermissionServiceTest {

    private final ProtocolSigningProperties signingProperties = new ProtocolSigningProperties();
    private final ProtocolPermissionService service = new ProtocolPermissionService(signingProperties);

    private static User user(UserRole role) {
        User u = new User();
        u.setRole(role);
        u.setType(ClientType.staff);
        u.setName("Test " + role);
        return u;
    }

    private static Protocol protocol(ProtocolStatus status) {
        Protocol p = new Protocol();
        p.setStatus(status);
        return p;
    }

    @Test
    void clientRole_getsNoPermissions() {
        ProtocolApiDtos.ProtocolPermissions perms = service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.CLIENT));
        assertFalse(perms.canView());
        assertFalse(perms.canEdit());
    }

    @Test
    void nullUser_getsNoPermissions() {
        ProtocolApiDtos.ProtocolPermissions perms = service.calculate(protocol(ProtocolStatus.DRAFT), null);
        assertEquals(ProtocolApiDtos.ProtocolPermissions.none(), perms);
    }

    @Test
    void laboratory_canEditDraftButNotApprove() {
        ProtocolApiDtos.ProtocolPermissions perms = service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.LABORATORY));
        assertTrue(perms.canEdit());
        assertTrue(perms.canSendToApproval());
        assertFalse(perms.canApprove());
        assertFalse(perms.canSign());
        assertFalse(perms.canReturnForRevision());
        assertFalse(perms.canCancel(), "DRAFT->CANCELLED is a valid transition, but LABORATORY isn't a supervisor");
    }

    @Test
    void admin_canApproveOnlyFromReadyForApproval() {
        ProtocolApiDtos.ProtocolPermissions readyPerms =
                service.calculate(protocol(ProtocolStatus.READY_FOR_APPROVAL), user(UserRole.ADMIN));
        assertTrue(readyPerms.canApprove());
        assertTrue(readyPerms.canReturnForRevision());

        ProtocolApiDtos.ProtocolPermissions draftPerms = service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.ADMIN));
        assertFalse(draftPerms.canApprove());
    }

    @Test
    void signedProtocol_isNotEditable_butCanBeCorrected() {
        ProtocolApiDtos.ProtocolPermissions perms = service.calculate(protocol(ProtocolStatus.SIGNED), user(UserRole.ADMIN));
        assertFalse(perms.canEdit());
        assertTrue(perms.canCreateCorrection());
        assertTrue(perms.canPublish());
    }

    @Test
    void canSign_requiresApprovedOrSigned_supervisorRole_underLimit_notAlreadySigned() {
        assertTrue(service.calculate(protocol(ProtocolStatus.APPROVED), user(UserRole.ADMIN), 0, false).canSign());
        assertTrue(service.calculate(protocol(ProtocolStatus.SIGNED), user(UserRole.ADMIN), 2, false).canSign(),
                "additional signers allowed while under the limit");
        assertFalse(service.calculate(protocol(ProtocolStatus.SIGNED), user(UserRole.ADMIN), 5, false).canSign(),
                "at the max signature count, no one else can sign");
        assertFalse(service.calculate(protocol(ProtocolStatus.SIGNED), user(UserRole.ADMIN), 2, true).canSign(),
                "a user who already signed this version can't sign again");
        assertFalse(service.calculate(protocol(ProtocolStatus.SIGNED), user(UserRole.LABORATORY), 0, false).canSign(),
                "module fix item 5: the READY-based self-sign shortcut is retired - LABORATORY "
                        + "never signs the formal APPROVED/SIGNED review path, supervisor-only");
        assertFalse(service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.ADMIN), 0, false).canSign());
    }

    @Test
    void generateAndRegenerateDocx_dependOnEditableStatusAndDocumentState() {
        Protocol noDocx = protocol(ProtocolStatus.DRAFT);
        ProtocolApiDtos.ProtocolPermissions noDocxPerms = service.calculate(noDocx, user(UserRole.LABORATORY));
        assertTrue(noDocxPerms.canGenerateDocx());
        assertFalse(noDocxPerms.canRegenerateDocx());

        Protocol withDocx = protocol(ProtocolStatus.DRAFT);
        withDocx.setDocxFileId("file-1");
        ProtocolApiDtos.ProtocolPermissions withDocxPerms = service.calculate(withDocx, user(UserRole.LABORATORY));
        assertFalse(withDocxPerms.canGenerateDocx());
        assertTrue(withDocxPerms.canRegenerateDocx());

        // Module fix item 7: APPROVED is not editable, so neither generate nor regenerate is ever
        // available - a user must returnToDraft() first, never regenerate an approved document.
        Protocol approvedWithDocx = protocol(ProtocolStatus.APPROVED);
        approvedWithDocx.setDocxFileId("file-1");
        ProtocolApiDtos.ProtocolPermissions approvedPerms = service.calculate(approvedWithDocx, user(UserRole.ADMIN));
        assertFalse(approvedPerms.canGenerateDocx());
        assertFalse(approvedPerms.canRegenerateDocx());
        assertFalse(approvedPerms.canGeneratePdf());
        assertFalse(approvedPerms.canRegeneratePdf());
    }

    @Test
    void downloadActions_availableRegardlessOfStoredFile_sinceBothEndpointsRenderOnDemand() {
        // ProtocolService#downloadDocx/#downloadDocxRendered (and the PDF equivalents) fall back
        // to an on-demand render when no file is stored yet - never a 403/404 for that reason
        // alone - so availability depends only on role/scope, not document state.
        Protocol noFiles = protocol(ProtocolStatus.DRAFT);
        ProtocolApiDtos.ProtocolPermissions noFilesPerms = service.calculate(noFiles, user(UserRole.LABORATORY));
        assertTrue(noFilesPerms.canDownloadDocx());
        assertTrue(noFilesPerms.canDownloadPdf());

        Protocol withFiles = protocol(ProtocolStatus.DRAFT);
        withFiles.setDocxFileId("d1");
        withFiles.setPdfFileId("p1");
        ProtocolApiDtos.ProtocolPermissions withFilesPerms = service.calculate(withFiles, user(UserRole.LABORATORY));
        assertTrue(withFilesPerms.canDownloadDocx());
        assertTrue(withFilesPerms.canDownloadPdf());
    }

    @Test
    void returnToDraft_onlySupervisorFromATransitionableStatus() {
        assertTrue(service.calculate(protocol(ProtocolStatus.APPROVED), user(UserRole.ADMIN)).canReturnToDraft());
        assertFalse(service.calculate(protocol(ProtocolStatus.APPROVED), user(UserRole.LABORATORY)).canReturnToDraft(),
                "LABORATORY isn't a supervisor");
        assertFalse(service.calculate(protocol(ProtocolStatus.SIGNED), user(UserRole.ADMIN)).canReturnToDraft(),
                "SIGNED has no transition back to DRAFT");
    }

    @Test
    void viewAudit_mirrorsView_evenForReadOnlyRoles() {
        assertTrue(service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.MANAGER)).canViewAudit());
        assertTrue(service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.LABORATORY)).canViewAudit());
        assertFalse(service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.CLIENT)).canViewAudit());
    }

    @Test
    void publishedProtocol_closesSignatureCollection() {
        Protocol p = protocol(ProtocolStatus.SIGNED);
        p.setPublishedAt(java.time.LocalDateTime.now());
        ProtocolApiDtos.ProtocolPermissions perms = service.calculate(p, user(UserRole.ADMIN), 1, false);
        assertFalse(perms.canPublish(), "already published - can't publish again");
        assertFalse(perms.canSign(), "publishing closes the signature-collection window");
    }
}
