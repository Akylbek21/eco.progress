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
                "LABORATORY is never a signer");
        assertFalse(service.calculate(protocol(ProtocolStatus.DRAFT), user(UserRole.ADMIN), 0, false).canSign());
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
