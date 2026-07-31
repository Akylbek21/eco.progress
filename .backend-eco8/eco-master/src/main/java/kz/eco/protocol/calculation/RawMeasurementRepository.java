package kz.eco.protocol.calculation;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RawMeasurementRepository extends JpaRepository<RawMeasurement, Long> {
    List<RawMeasurement> findByProtocolResultId(Long protocolResultId);
    Optional<RawMeasurement> findByProtocolResultIdAndVariableKey(Long protocolResultId, String variableKey);
    void deleteByProtocolResultId(Long protocolResultId);
}
