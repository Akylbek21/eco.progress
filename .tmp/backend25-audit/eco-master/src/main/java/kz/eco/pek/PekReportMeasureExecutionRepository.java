package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekReportMeasureExecutionRepository extends JpaRepository<PekReportMeasureExecution, Long> {
    List<PekReportMeasureExecution> findByReportId(Long reportId);
}
