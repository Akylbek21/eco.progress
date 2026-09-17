package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PekReportWorkflowGuardTest {
    private final PekReportWorkflowGuard guard = new PekReportWorkflowGuard();

    @ParameterizedTest
    @EnumSource(value = PekReportStatus.class, names = {"DRAFT", "COLLECTING", "RETURNED"})
    void editableStatusesAllowEvidenceMutation(PekReportStatus status) {
        PekReport report = new PekReport();
        report.setStatus(status);
        assertDoesNotThrow(() -> guard.requireEditable(report));
    }

    @ParameterizedTest
    @EnumSource(value = PekReportStatus.class, names = {"READY_FOR_REVIEW", "APPROVED", "ARCHIVED"})
    void closedStatusesRejectEvidenceMutation(PekReportStatus status) {
        PekReport report = new PekReport();
        report.setStatus(status);
        ConflictException error = assertThrows(ConflictException.class, () -> guard.requireEditable(report));
        assertEquals("PEK_REPORT_NOT_EDITABLE", error.getCode());
    }
}
