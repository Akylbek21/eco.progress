package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekReportWasteMovementRepository extends JpaRepository<PekReportWasteMovement, Long> {
    List<PekReportWasteMovement> findByReportIdOrderByIdAsc(Long reportId);
    Optional<PekReportWasteMovement> findByIdAndReportId(Long id, Long reportId);
    Optional<PekReportWasteMovement> findByReportIdAndWasteItemId(Long reportId, Long wasteItemId);
    boolean existsByWasteItemId(Long wasteItemId);
    void deleteByReportId(Long reportId);
}
