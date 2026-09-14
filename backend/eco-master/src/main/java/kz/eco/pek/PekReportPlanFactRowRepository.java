package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekReportPlanFactRowRepository extends JpaRepository<PekReportPlanFactRow, Long> {

    List<PekReportPlanFactRow> findByReportIdOrderByControlItemIdAsc(Long reportId);

    Optional<PekReportPlanFactRow> findByReportIdAndProgramIndicatorId(Long reportId, Long programIndicatorId);

    /** Used to block physically deleting a program indicator that already has computed plan/fact
     *  rows against it - same rationale, and same FK-violation-avoidance need, as
     *  PekReportProtocolSourceRepository#existsByControlItemId for control items (Task 6). */
    boolean existsByProgramIndicatorId(Long programIndicatorId);

    @org.springframework.data.jpa.repository.Query("select coalesce(sum(r.missingCount),0) from PekReportPlanFactRow r where r.reportId in :reportIds")
    long sumMissingByReportIds(@org.springframework.data.repository.query.Param("reportIds") java.util.Collection<Long> reportIds);
}
