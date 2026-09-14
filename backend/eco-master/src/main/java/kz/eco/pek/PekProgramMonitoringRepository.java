package kz.eco.pek;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface PekProgramMonitoringRepository extends JpaRepository<PekProgramMonitoring,Long> {
    List<PekProgramMonitoring> findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(Long programId);
    Optional<PekProgramMonitoring> findByIdAndProgramId(Long id, Long programId);
    boolean existsByProgramIdAndMonitoringType(Long programId, PekMonitoringType type);
    List<PekProgramMonitoring> findByProgramId(Long programId);
    void deleteByProgramId(Long programId);
}
