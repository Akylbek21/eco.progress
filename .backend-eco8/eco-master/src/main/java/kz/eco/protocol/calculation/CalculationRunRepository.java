package kz.eco.protocol.calculation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CalculationRunRepository extends JpaRepository<CalculationRun, Long> {
    List<CalculationRun> findByProtocolResultIdOrderByCreatedAtDesc(Long protocolResultId);
    List<CalculationRun> findByProtocolIdOrderByCreatedAtDesc(Long protocolId);
}
