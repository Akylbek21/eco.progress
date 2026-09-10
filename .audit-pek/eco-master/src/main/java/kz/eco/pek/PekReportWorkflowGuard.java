package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
import org.springframework.stereotype.Component;

@Component
public class PekReportWorkflowGuard {
    public void requireEditable(PekReport report) {
        if (report == null || !report.getStatus().isEditable()) {
            throw new ConflictException(
                    "Источники нельзя изменять в текущем статусе отчёта",
                    "PEK_REPORT_NOT_EDITABLE");
        }
    }
}
