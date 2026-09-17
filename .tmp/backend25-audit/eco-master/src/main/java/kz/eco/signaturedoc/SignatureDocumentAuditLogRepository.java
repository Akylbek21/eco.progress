package kz.eco.signaturedoc;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SignatureDocumentAuditLogRepository extends JpaRepository<SignatureDocumentAuditLog, Long> {

    List<SignatureDocumentAuditLog> findByDocumentIdOrderByTimestampDesc(Long documentId);
}
