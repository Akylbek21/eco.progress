package kz.ecoprogress.documentflow.signing;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentFlowAuditLogRepository extends JpaRepository<DocumentFlowAuditLog, Long> {
    List<DocumentFlowAuditLog> findAllByDocumentIdOrderByCreatedAtDesc(Long documentId);

    /** Module spec §18: paginated/filterable read for GET .../audit. */
    Page<DocumentFlowAuditLog> findAllByDocumentIdOrderByCreatedAtDesc(Long documentId, Pageable pageable);

    Page<DocumentFlowAuditLog> findAllByDocumentIdAndActionOrderByCreatedAtDesc(Long documentId, String action, Pageable pageable);
}
