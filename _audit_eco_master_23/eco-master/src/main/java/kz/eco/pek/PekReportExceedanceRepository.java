package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekReportExceedanceRepository extends JpaRepository<PekReportExceedance, Long> {

    List<PekReportExceedance> findByReportId(Long reportId);

    List<PekReportExceedance> findByPlanFactRowId(Long planFactRowId);

    Optional<PekReportExceedance> findByReportIdAndProtocolResultId(Long reportId, Long protocolResultId);

    long countByReportIdAndStatus(Long reportId, PekExceedanceStatus status);

    /** Kept in sync with {@link PekExceedanceStatus#isOpen()} - RESOLVED/FALSE_POSITIVE/CLOSED/
     *  CANCELLED are all terminal outcomes and must not count as "still needs attention". */
    @org.springframework.data.jpa.repository.Query("select count(e) from PekReportExceedance e where e.reportId=:reportId "
            + "and e.status not in (kz.eco.pek.PekExceedanceStatus.RESOLVED, kz.eco.pek.PekExceedanceStatus.FALSE_POSITIVE, "
            + "kz.eco.pek.PekExceedanceStatus.CLOSED, kz.eco.pek.PekExceedanceStatus.CANCELLED)")
    long countOpenByReportId(@org.springframework.data.repository.query.Param("reportId") Long reportId);

    @org.springframework.data.jpa.repository.Query("select count(e) from PekReportExceedance e where e.reportId in :reportIds "
            + "and e.status not in (kz.eco.pek.PekExceedanceStatus.RESOLVED, kz.eco.pek.PekExceedanceStatus.FALSE_POSITIVE, "
            + "kz.eco.pek.PekExceedanceStatus.CLOSED, kz.eco.pek.PekExceedanceStatus.CANCELLED)")
    long countOpenByReportIds(@org.springframework.data.repository.query.Param("reportIds") java.util.Collection<Long> reportIds);

    /** Iteration 2: an "overdue action" is an exceedance still open past its dueDate - real count
     *  used by the dashboard's overdueActionCount, replacing the previous hardcoded 0 (no Exceedance
     *  entity had a dueDate field before this iteration). */
    @org.springframework.data.jpa.repository.Query("select count(e) from PekReportExceedance e where e.reportId in :reportIds "
            + "and e.dueDate is not null and e.dueDate < :today "
            + "and e.status not in (kz.eco.pek.PekExceedanceStatus.RESOLVED, kz.eco.pek.PekExceedanceStatus.FALSE_POSITIVE, "
            + "kz.eco.pek.PekExceedanceStatus.CLOSED, kz.eco.pek.PekExceedanceStatus.CANCELLED)")
    long countOverdueByReportIds(@org.springframework.data.repository.query.Param("reportIds") java.util.Collection<Long> reportIds,
                                  @org.springframework.data.repository.query.Param("today") java.time.LocalDate today);
}
