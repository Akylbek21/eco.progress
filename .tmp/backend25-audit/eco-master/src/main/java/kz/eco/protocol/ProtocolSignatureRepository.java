package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProtocolSignatureRepository extends JpaRepository<ProtocolSignature, Long> {

    boolean existsByProtocolIdAndProtocolVersionAndUserId(Long protocolId, Long protocolVersion, Long userId);

    long countByProtocolIdAndProtocolVersion(Long protocolId, Long protocolVersion);

    List<ProtocolSignature> findAllByProtocolIdAndProtocolVersionOrderBySignedAtAsc(Long protocolId, Long protocolVersion);

    boolean existsByProtocolIdAndProtocolVersion(Long protocolId, Long protocolVersion);

    /** Batch load for GET /api/protocols (paginated list) - one query for the whole page's
     *  protocol ids instead of one query per row (see ProtocolService.toListItem). Grouping by
     *  (protocolId, protocolVersion) happens in-memory afterward since a page is small
     *  (<= 100 rows) and IN-pair grouping in SQL would need a much uglier query. */
    List<ProtocolSignature> findAllByProtocolIdIn(List<Long> protocolIds);
}
