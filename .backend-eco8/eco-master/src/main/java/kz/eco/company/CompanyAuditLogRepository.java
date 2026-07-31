package kz.eco.company;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompanyAuditLogRepository extends JpaRepository<CompanyAuditLog, Long> {
    List<CompanyAuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId);
}
