package kz.eco.pek;

import kz.eco.user.UserRole;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pins the PEK_* matrix advertised in /api/auth/me. The bug this guards: production returned no
 *  permissions at all, so the UI let an ADMIN open ПЭК but refused every create/edit action. */
class PekPermissionMatrixTest {

    /** The exact set an ADMIN must receive - ADMIN administers the module, so it holds every
     *  advertised permission. */
    private static final List<String> ADMIN_REQUIRED = List.of(
            "PEK_VIEW", "PEK_PROGRAM_VIEW", "PEK_PROGRAM_CREATE", "PEK_PROGRAM_EDIT",
            "PEK_PROGRAM_SUBMIT", "PEK_PROGRAM_APPROVE", "PEK_PROGRAM_ACTIVATE",
            "PEK_PROGRAM_ARCHIVE", "PEK_REPORT_VIEW", "PEK_REPORT_CREATE", "PEK_REPORT_EDIT",
            "PEK_REPORT_COLLECT", "PEK_REPORT_MATCH", "PEK_REPORT_VALIDATE", "PEK_REPORT_REVIEW",
            "PEK_REPORT_RETURN", "PEK_REPORT_APPROVE", "PEK_REPORT_SIGN", "PEK_REPORT_SUBMIT",
            "PEK_REPORT_EXPORT", "PEK_SETTINGS_EDIT", "PEK_ADMIN");

    @Test
    void admin_receivesEveryRequiredPekPermission() {
        Set<String> admin = PekPermissionMatrix.forRole(UserRole.ADMIN);
        for (String permission : ADMIN_REQUIRED) {
            assertTrue(admin.contains(permission), "ADMIN must hold " + permission);
        }
        assertEquals(PekPermissionMatrix.allPermissions(), admin,
                "ADMIN administers the module and should hold the full advertised set");
    }

    /** DIRECTOR is a global-access supervisor role: everything except nothing in particular -
     *  it appears in every PEK expression, same as ADMIN. */
    @Test
    void director_holdsSupervisorPermissions() {
        Set<String> director = PekPermissionMatrix.forRole(UserRole.DIRECTOR);
        assertTrue(director.containsAll(List.of(
                "PEK_VIEW", "PEK_PROGRAM_CREATE", "PEK_PROGRAM_APPROVE", "PEK_PROGRAM_ACTIVATE",
                "PEK_REPORT_APPROVE", "PEK_REPORT_SIGN", "PEK_SETTINGS_EDIT", "PEK_ADMIN")));
    }

    /** HEAD supervises but does not administer the module. */
    @Test
    void head_supervisesButIsNotPekAdmin() {
        Set<String> head = PekPermissionMatrix.forRole(UserRole.HEAD);
        assertTrue(head.containsAll(List.of(
                "PEK_VIEW", "PEK_PROGRAM_EDIT", "PEK_PROGRAM_APPROVE", "PEK_PROGRAM_ACTIVATE",
                "PEK_REPORT_APPROVE", "PEK_REPORT_RETURN", "PEK_SETTINGS_EDIT")));
        assertFalse(head.contains("PEK_ADMIN"), "PEK_ADMIN is ADMIN/DIRECTOR only");
    }

    /** ECOLOGIST authors programs and reports but must not approve or activate its own work -
     *  the same author/reviewer separation PekSecurityExpressions documents. */
    @Test
    void ecologist_authorsButDoesNotApproveOrActivate() {
        Set<String> ecologist = PekPermissionMatrix.forRole(UserRole.ECOLOGIST);
        assertTrue(ecologist.containsAll(List.of(
                "PEK_VIEW", "PEK_PROGRAM_CREATE", "PEK_PROGRAM_EDIT", "PEK_PROGRAM_SUBMIT",
                "PEK_REPORT_CREATE", "PEK_REPORT_EDIT", "PEK_REPORT_SIGN", "PEK_REPORT_SUBMIT")));
        assertFalse(ecologist.contains("PEK_PROGRAM_APPROVE"));
        assertFalse(ecologist.contains("PEK_PROGRAM_ACTIVATE"));
        assertFalse(ecologist.contains("PEK_REPORT_APPROVE"));
        assertFalse(ecologist.contains("PEK_ADMIN"));
        assertFalse(ecologist.contains("PEK_SETTINGS_EDIT"));
    }

    /** LABORATORY contributes report data (protocols) only - no program authoring, no approval. */
    @Test
    void laboratory_contributesReportDataOnly() {
        Set<String> lab = PekPermissionMatrix.forRole(UserRole.LABORATORY);
        assertTrue(lab.containsAll(List.of(
                "PEK_VIEW", "PEK_REPORT_CREATE", "PEK_REPORT_EDIT", "PEK_REPORT_COLLECT",
                "PEK_REPORT_MATCH")));
        assertFalse(lab.contains("PEK_PROGRAM_CREATE"));
        assertFalse(lab.contains("PEK_PROGRAM_EDIT"));
        assertFalse(lab.contains("PEK_REPORT_APPROVE"));
        assertFalse(lab.contains("PEK_REPORT_SIGN"));
        assertFalse(lab.contains("PEK_ADMIN"));
    }

    /** A CLIENT is not staff and gets no PEK rights at all - the UI must not render the module. */
    @Test
    void client_receivesNoPekPermissions() {
        assertTrue(PekPermissionMatrix.forRole(UserRole.CLIENT).isEmpty());
    }

    @Test
    void nullRole_yieldsEmptySet() {
        assertTrue(PekPermissionMatrix.forRole(null).isEmpty());
    }

    @Test
    void returnedSetIsImmutable() {
        assertThrows(UnsupportedOperationException.class,
                () -> PekPermissionMatrix.forRole(UserRole.ADMIN).add("PEK_FORGED"));
    }

    /** Every advertised permission must be derived from a real gate: no role may receive a
     *  permission that no PekSecurityExpressions role list actually grants. */
    @Test
    void everyAdvertisedPermissionIsGrantedToAtLeastOneRole() {
        for (String permission : PekPermissionMatrix.allPermissions()) {
            boolean grantedSomewhere = false;
            for (UserRole role : UserRole.values()) {
                if (PekPermissionMatrix.forRole(role).contains(permission)) {
                    grantedSomewhere = true;
                    break;
                }
            }
            assertTrue(grantedSomewhere, permission + " is advertised but granted to no role");
        }
    }
}
