package kz.eco.protocol;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProtocolAuditLogRepository extends JpaRepository<ProtocolAuditLog, Long> {
    List<ProtocolAuditLog> findByProtocolIdOrderByCreatedAtDesc(Long protocolId);
}
