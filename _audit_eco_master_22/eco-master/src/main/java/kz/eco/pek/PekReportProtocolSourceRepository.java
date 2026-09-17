package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PekReportProtocolSourceRepository extends JpaRepository<PekReportProtocolSource, Long> {

    List<PekReportProtocolSource> findByReportId(Long reportId);

    List<PekReportProtocolSource> findByReportIdOrderByCreatedAtAsc(Long reportId);

    /** Used by kz.eco.protocol.ProtocolAccessService to resolve which protocols an ECOLOGIST's PEK
     *  company memberships give them scope over - every protocol linked (as evidence) to a report
     *  belonging to one of their accessible companies. */
    @Query("select distinct s.protocolId from PekReportProtocolSource s "
            + "where s.reportId in :reportIds and s.protocolId is not null")
    List<Long> findDistinctProtocolIdsByReportIdIn(@Param("reportIds") java.util.Collection<Long> reportIds);

    List<PekReportProtocolSource> findByProtocolIdOrderByCreatedAtAsc(Long protocolId);

    List<PekReportProtocolSource> findByProgramIdOrderByCreatedAtAsc(Long programId);

    List<PekReportProtocolSource> findByControlItemIdOrderByCreatedAtAsc(Long controlItemId);

    Optional<PekReportProtocolSource> findByReportIdAndProtocolIdAndProtocolResultIdIsNull(
            Long reportId, Long protocolId);

    /** Client-supplied idempotency lookup (see PekReportProtocolSource.clientLinkId) - the only
     *  reliable dedup path for links created without a reportId (protocol-initiated flow, before a
     *  pek_reports row exists). Backed by the unique index uk_pek_rps_protocol_client_link (V74). */
    Optional<PekReportProtocolSource> findByProtocolIdAndClientLinkId(Long protocolId, String clientLinkId);

    /** Blocker 1: the DB-unique requirement identity (uk_pek_rps_requirement, V110) - used both to
     *  find the draft that already covers a requirement and to resolve the winner after a
     *  concurrent insert lost the race. */
    Optional<PekReportProtocolSource> findByRequirementKey(String requirementKey);

    /** Every link (across all reports, and links with no report yet) that belongs to one control
     *  item of one program - the real input to "how much of this requirement is already done". */
    List<PekReportProtocolSource> findByProgramIdAndControlItemIdAndExcludedFalseOrderByIdAsc(
            Long programId, Long controlItemId);

    List<PekReportProtocolSource> findByProgramIdAndExcludedFalseOrderByIdAsc(Long programId);

    List<PekReportProtocolSource> findByReportIdAndExcludedFalse(Long reportId);

    /** The per-result row for one specific ProtocolResult within a report, if collect() has
     *  already created it - used both to avoid duplicating rows on repeated collect() calls and by
     *  PekPlanFactService to aggregate actual measurements per indicator. */
    Optional<PekReportProtocolSource> findByReportIdAndProtocolResultId(Long reportId, Long protocolResultId);

    /** Real, non-excluded per-result measurements matched to one program indicator within a
     *  report - the actual input to plan/fact's actualCount/best/worst/average and exceedance
     *  detection. Excludes the whole-protocol rows (protocolResultId null) by construction, since
     *  programIndicatorId is only ever set on per-result rows. */
    @Query("select s from PekReportProtocolSource s where s.reportId = :reportId "
            + "and s.programIndicatorId = :programIndicatorId and s.excluded = false "
            + "and s.matchStatus in (kz.eco.pek.PekMatchStatus.MATCHED, kz.eco.pek.PekMatchStatus.MANUALLY_MATCHED)")
    List<PekReportProtocolSource> findByReportIdAndProgramIndicatorIdAndExcludedFalse(
            @Param("reportId") Long reportId, @Param("programIndicatorId") Long programIndicatorId);

    /** Used by PekReportCollectionService for the idempotent-recollect / duplicate check: a
     *  whole-protocol link (protocolResultId null) already exists for this (report, protocol) pair.
     *  MySQL's unique index alone would not stop two concurrent inserts of NULL protocolResultId
     *  rows from both succeeding (NULLs never compare equal in a unique index), so collect() checks
     *  this explicitly before inserting. */
    boolean existsByReportIdAndProtocolIdAndProtocolResultIdIsNull(Long reportId, Long protocolId);

    long countByReportIdAndExcludedFalse(Long reportId);
    long countByReportIdAndMatchStatusAndExcludedFalse(Long reportId, PekMatchStatus status);
    long countByReportIdAndMatchStatus(Long reportId, PekMatchStatus status);
    long countByReportIdAndProtocolResultIdIsNotNullAndExcludedFalse(Long reportId);
    long countByReportIdAndExcludedTrue(Long reportId);
    long countByReportIdInAndMatchStatusAndExcludedFalse(java.util.Collection<Long> reportIds, PekMatchStatus status);
    long countByReportIdInAndMatchStatus(java.util.Collection<Long> reportIds, PekMatchStatus status);

    /** The real "how many distinct protocols does this report have evidence from" count (Task 1
     *  fix) - {@link #countByReportIdAndExcludedFalse} counts ROWS, and one protocol can now
     *  legitimately own several rows (the whole-protocol row plus one per matched/unmatched/
     *  ambiguous ProtocolResult), which made the old row-count double- (or many-times-) count a
     *  protocol with more than one result. protocolId is never null on a real source row, but the
     *  null-guard keeps this safe if that ever changes. */
    @Query("select count(distinct s.protocolId) from PekReportProtocolSource s "
            + "where s.reportId = :reportId and s.excluded = false and s.protocolId is not null "
            + "and s.matchStatus in (kz.eco.pek.PekMatchStatus.MATCHED, kz.eco.pek.PekMatchStatus.MANUALLY_MATCHED)")
    long countDistinctProtocolsByReportId(@Param("reportId") Long reportId);

    /** Used to block physically deleting a control item that a report has already matched
     *  protocol results against (module spec §4: "если объект уже использован в согласованном
     *  отчёте — запретить физическое удаление") - checked regardless of the owning report's own
     *  status, since even a DRAFT/COLLECTING report's matches would be silently orphaned by the
     *  delete, not just an approved one. */
    boolean existsByControlItemId(Long controlItemId);

    /** Same rationale as {@link #existsByControlItemId} but for indicator deletion (Task 6) - a
     *  program indicator that already has matched result rows against it must not be physically
     *  removable, both to avoid the FK violation (fk_pek_sources_indicator, V59) reaching the DB
     *  uncaught and to avoid silently orphaning real matched evidence. */
    boolean existsByProgramIndicatorId(Long programIndicatorId);

    /** Backs GET /api/pek/reports/{id}/sources - every filter optional, same null-guarded JPQL
     *  style as PekReportRepository#findForDashboard. matchStatus/protocolId/excluded/manual are
     *  the filters a reconciliation-review UI actually needs (e.g. "show me AMBIGUOUS rows for
     *  protocol X"). */
    @Query("""
            select s from PekReportProtocolSource s
            where s.reportId = :reportId
              and (:matchStatus is null or s.matchStatus = :matchStatus)
              and (:protocolId is null or s.protocolId = :protocolId)
              and (:excluded is null or s.excluded = :excluded)
              and (:manual is null or s.manual = :manual)
            order by s.protocolId asc, s.protocolResultId asc
            """)
    List<PekReportProtocolSource> search(@Param("reportId") Long reportId,
                                          @Param("matchStatus") PekMatchStatus matchStatus,
                                          @Param("protocolId") Long protocolId,
                                          @Param("excluded") Boolean excluded,
                                          @Param("manual") Boolean manual);
}
