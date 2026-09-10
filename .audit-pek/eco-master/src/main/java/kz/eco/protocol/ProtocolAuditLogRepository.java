package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProtocolAuditLogRepository extends JpaRepository<ProtocolAuditLog, Long> {
    /** id DESC as a tiebreaker (not just createdAt) - two audit rows for the same protocol can
     *  share a millisecond-resolution timestamp when several mutations happen in quick succession
     *  (e.g. a test that adds a result, updates the protocol, then cancels it), and createdAt alone
     *  doesn't guarantee insertion order in that case. */
    List<ProtocolAuditLog> findByProtocolIdOrderByCreatedAtDescIdDesc(Long protocolId);

    List<ProtocolAuditLog> findByProtocolIdOrderByCreatedAtDesc(Long protocolId);
}
