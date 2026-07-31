package kz.eco.pek;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PekReportRepository extends JpaRepository<PekReport, Long> {

    List<PekReport> findByCompanyIdAndObjectIdOrderByPeriodStartDesc(Long companyId, Long objectId);

    Page<PekReport> findByCompanyIdAndObjectId(Long companyId, Long objectId, Pageable pageable);

    Optional<PekReport> findByObjectIdAndProgramIdAndPeriodKey(Long objectId, Long programId, String periodKey);

    /** Backs GET /api/pek/dashboard - every filter is optional (spec §3/§11: absent companyId/
     *  objectId means "everything visible to the caller", not a 400), so this can't be expressed
     *  as a Spring Data derived-query method. */
    @Query("""
            select r from PekReport r
            where (:companyId is null or r.companyId = :companyId)
              and (:objectId is null or r.objectId = :objectId)
              and (:year is null or r.reportYear = :year)
              and (:quarter is null or r.reportQuarter = :quarter)
              and (:status is null or r.status = :status)
              and (:responsibleId is null or r.responsibleUserId = :responsibleId)
            order by r.periodStart desc
            """)
    List<PekReport> findForDashboard(@Param("companyId") Long companyId, @Param("objectId") Long objectId,
                                      @Param("year") Integer year, @Param("quarter") Integer quarter,
                                      @Param("status") PekReportStatus status, @Param("responsibleId") Long responsibleId);
}
