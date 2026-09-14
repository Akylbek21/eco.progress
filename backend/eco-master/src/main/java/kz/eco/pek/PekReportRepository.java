package kz.eco.pek;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PekReportRepository extends JpaRepository<PekReport, Long> {

    List<PekReport> findByCompanyIdAndObjectIdOrderByPeriodStartDesc(Long companyId, Long objectId);

    /** Real DB-level row lock (SELECT ... FOR UPDATE), not an in-JVM {@code synchronized} - used by
     *  PekReportCollectionService#collect so two concurrent collect() runs against the same report
     *  serialize instead of both reading the same "actual protocol set" and racing on the
     *  aggregate's linkedProtocolCount/lastCollectedAt fields. Scoped to collect() only; every other
     *  read/write path on PekReport keeps using the plain optimistic-lock (@Version) flow via
     *  findById/save, since only collect() does the read-many-rows-then-write-aggregate dance that
     *  a lost update could actually corrupt. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from PekReport r where r.id = :id")
    Optional<PekReport> findByIdForUpdate(@Param("id") Long id);

    Page<PekReport> findByCompanyIdAndObjectId(Long companyId, Long objectId, Pageable pageable);

    Optional<PekReport> findByObjectIdAndProgramIdAndPeriodKey(Long objectId, Long programId, String periodKey);

    /** Tenant-scoped listing for a non-global caller. */
    List<PekReport> findByCompanyIdIn(List<Long> companyIds);

    /** Iteration 4: scheduler's "reports needing attention" scan - editable reports (still being
     *  assembled, eligible for auto-collect) plus RETURNED/READY_FOR_REVIEW ones the due-date and
     *  exceedance checks also care about. Backed by ix_pek_reports_status_period_end. */
    List<PekReport> findByStatusIn(List<PekReportStatus> statuses);

    /** Module fix item 5: company-scoped scheduler run (manualRun(companyId)) - the same candidate
     *  set as findByStatusIn above, restricted to one company instead of always sweeping all. */
    List<PekReport> findByCompanyIdAndStatusIn(Long companyId, List<PekReportStatus> statuses);

    List<PekReport> findByProgramId(Long programId);

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
              and (:companyIds is null or r.companyId in :companyIds)
            order by r.periodStart desc
            """)
    List<PekReport> findForDashboard(@Param("companyId") Long companyId, @Param("objectId") Long objectId,
                                      @Param("year") Integer year, @Param("quarter") Integer quarter,
                                      @Param("status") PekReportStatus status, @Param("responsibleId") Long responsibleId,
                                      @Param("companyIds") List<Long> companyIds);

    /** Module fix item 4: backs GET /api/pek/reports - filtering (companyId/objectId/programId/
     *  status/issue) happens here, in the repository query, BEFORE pagination - so totalElements/
     *  totalPages reflect the already-filtered result set, not the unfiltered one. objectId/
     *  programId/status are optional (null = "any"); issue is one of UNMATCHED_SOURCES/
     *  AMBIGUOUS_SOURCES/STALE_SOURCES/OPEN_EXCEEDANCES or null for "no issue filter" - each maps to
     *  an EXISTS subquery against the same tables PekReportReadinessService reads from, so "reports
     *  with this issue" means exactly what the readiness check means. */
    @Query("""
            select r from PekReport r
            where r.companyId = :companyId
              and (:objectId is null or r.objectId = :objectId)
              and (:programId is null or r.programId = :programId)
              and (:status is null or r.status = :status)
              and (
                :issue is null
                or (:issue = 'UNMATCHED_SOURCES' and exists (
                        select 1 from PekReportProtocolSource s
                        where s.reportId = r.id and s.excluded = false and s.matchStatus = kz.eco.pek.PekMatchStatus.UNMATCHED))
                or (:issue = 'AMBIGUOUS_SOURCES' and exists (
                        select 1 from PekReportProtocolSource s
                        where s.reportId = r.id and s.excluded = false and s.matchStatus = kz.eco.pek.PekMatchStatus.AMBIGUOUS))
                or (:issue = 'STALE_SOURCES' and exists (
                        select 1 from PekReportProtocolSource s
                        where s.reportId = r.id and s.matchStatus = kz.eco.pek.PekMatchStatus.STALE))
                or (:issue = 'OPEN_EXCEEDANCES' and exists (
                        select 1 from PekReportExceedance e
                        where e.reportId = r.id and e.status not in (
                            kz.eco.pek.PekExceedanceStatus.RESOLVED, kz.eco.pek.PekExceedanceStatus.FALSE_POSITIVE,
                            kz.eco.pek.PekExceedanceStatus.CLOSED, kz.eco.pek.PekExceedanceStatus.CANCELLED)))
              )
            """)
    Page<PekReport> search(@Param("companyId") Long companyId, @Param("objectId") Long objectId,
                            @Param("programId") Long programId, @Param("status") PekReportStatus status,
                            @Param("issue") String issue, Pageable pageable);
}
