package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekSubmissionDeadlineRuleRepository extends JpaRepository<PekSubmissionDeadlineRuleRow, Long> {

    Optional<PekSubmissionDeadlineRuleRow> findByReportTypeAndRegulationCodeAndActiveTrue(
            PekReportType reportType, String regulationCode);

    List<PekSubmissionDeadlineRuleRow> findAllByOrderByRegulationCodeAscReportTypeAsc();

    boolean existsByRegulationCode(String regulationCode);
}
