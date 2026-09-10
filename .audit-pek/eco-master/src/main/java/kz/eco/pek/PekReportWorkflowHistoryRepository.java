package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PekReportWorkflowHistoryRepository extends JpaRepository<PekReportWorkflowHistory, Long> {
    List<PekReportWorkflowHistory> findByReportIdOrderByPerformedAtAscIdAsc(Long reportId);
}
