package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProtocolEnvironmentConditionsRepository extends JpaRepository<ProtocolEnvironmentConditions, Long> {
    Optional<ProtocolEnvironmentConditions> findByProtocolId(Long protocolId);
    void deleteByProtocolId(Long protocolId);
}
