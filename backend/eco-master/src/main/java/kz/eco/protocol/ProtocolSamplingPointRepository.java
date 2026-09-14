package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ProtocolSamplingPointRepository extends JpaRepository<ProtocolSamplingPoint, Long> {

    List<ProtocolSamplingPoint> findByProtocolIdOrderBySortOrderAscIdAsc(Long protocolId);

    Optional<ProtocolSamplingPoint> findByIdAndProtocolId(Long id, Long protocolId);

    boolean existsByProtocolId(Long protocolId);

    long countByProtocolId(Long protocolId);

    /** Bulk-null samplingPointId on results that reference a point being deleted. Called before
     *  deletion in service-layer cascade so we can 409 when results exist instead. */
    @Query("SELECT COUNT(r) FROM ProtocolResult r WHERE r.samplingPointId = :pointId")
    long countResultsByPointId(Long pointId);
}
