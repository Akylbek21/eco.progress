package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PekReportProtocolSourceRepository extends JpaRepository<PekReportProtocolSource, Long> {

    List<PekReportProtocolSource> findByReportId(Long reportId);

    List<PekReportProtocolSource> findByReportIdAndExcludedFalse(Long reportId);

    /** Used by PekReportCollectionService for the idempotent-recollect / duplicate check: a
     *  whole-protocol link (protocolResultId null) already exists for this (report, protocol) pair.
     *  MySQL's unique index alone would not stop two concurrent inserts of NULL protocolResultId
     *  rows from both succeeding (NULLs never compare equal in a unique index), so collect() checks
     *  this explicitly before inserting. */
    boolean existsByReportIdAndProtocolIdAndProtocolResultIdIsNull(Long reportId, Long protocolId);

    long countByReportIdAndExcludedFalse(Long reportId);
}
