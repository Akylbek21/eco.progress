package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PekMonitoringPointRepository extends JpaRepository<PekMonitoringPoint, Long> {

    /** Batch load for readiness evaluation of a page of programs (avoids per-program queries). */
    List<PekMonitoringPoint> findByProgramIdIn(java.util.Collection<Long> programIds);
    List<PekMonitoringPoint> findByMonitoringIdOrderByIdAsc(Long monitoringId);
    List<PekMonitoringPoint> findByProgramIdOrderByIdAsc(Long programId);
    Optional<PekMonitoringPoint> findByIdAndProgramId(Long id, Long programId);
    void deleteByProgramId(Long programId);
}
