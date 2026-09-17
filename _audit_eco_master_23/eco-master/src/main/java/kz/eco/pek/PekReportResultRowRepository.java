package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PekReportResultRowRepository extends JpaRepository<PekReportResultRow, Long> {

    List<PekReportResultRow> findByReportIdOrderBySectionTypeAscIndicatorNameAsc(Long reportId);

    List<PekReportResultRow> findByReportIdAndSectionTypeOrderByIndicatorNameAsc(Long reportId, PekOfficialTableType sectionType);

    @Modifying
    @Query("delete from PekReportResultRow r where r.reportId = :reportId")
    void deleteByReportId(@Param("reportId") Long reportId);

    long countByReportId(Long reportId);
}
