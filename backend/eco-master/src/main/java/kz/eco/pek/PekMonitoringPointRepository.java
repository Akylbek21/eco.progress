package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekMonitoringPointRepository extends JpaRepository<PekMonitoringPoint, Long> {
    List<PekMonitoringPoint> findByMonitoringIdOrderByIdAsc(Long monitoringId);
    List<PekMonitoringPoint> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekMonitoringPoint> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
