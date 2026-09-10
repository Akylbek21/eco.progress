package kz.eco.pek;

import kz.eco.user.UserRole;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PekPermissionMatrixTest {

    @Test
    void exposesAdministratorRoutePermissionsUsedByTheFrontend() {
        assertThat(PekPermissionMatrix.forRole(UserRole.ADMIN))
                .contains("PEK_VIEW", "PEK_PROGRAM_CREATE", "PEK_PROGRAM_EDIT",
                        "PEK_REPORT_CREATE", "PEK_REPORT_APPROVE", "PEK_SETTINGS_EDIT", "PEK_ADMIN");
    }

    @Test
    void laboratoryCanCollectReportsButCannotApproveOrSubmitThem() {
        assertThat(PekPermissionMatrix.forRole(UserRole.LABORATORY))
                .contains("PEK_VIEW", "PEK_REPORT_CREATE", "PEK_REPORT_COLLECT")
                .doesNotContain("PEK_PROGRAM_CREATE", "PEK_REPORT_APPROVE", "PEK_REPORT_SUBMIT", "PEK_SETTINGS_EDIT");
    }

    @Test
    void clientReceivesNoPekPermissions() {
        assertThat(PekPermissionMatrix.forRole(UserRole.CLIENT)).isEmpty();
    }
}
