package kz.ecoprogress.documentflow.signing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentFlowAuditLogRepository extends JpaRepository<DocumentFlowAuditLog, Long> {
    List<DocumentFlowAuditLog> findAllByDocumentIdOrderByCreatedAtDesc(Long documentId);
}
