package kz.ecoprogress.documentflow.revocation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RevocationRequestRepository extends JpaRepository<RevocationRequest, Long> {
    List<RevocationRequest> findAllByDocumentIdOrderByCreatedAtDesc(Long documentId);
}
