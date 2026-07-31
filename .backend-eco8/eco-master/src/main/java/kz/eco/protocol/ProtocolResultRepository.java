package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProtocolResultRepository extends JpaRepository<ProtocolResult, Long> {
    List<ProtocolResult> findByProtocolIdOrderByRowNumberAsc(Long protocolId);

    Optional<ProtocolResult> findTopByProtocolIdOrderByRowNumberDesc(Long protocolId);

    void deleteByProtocolId(Long protocolId);

    long countByProtocolId(Long protocolId);
}
