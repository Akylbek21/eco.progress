package kz.ecoprogress.documentflow.signing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentFlowSignatureRepository extends JpaRepository<DocumentFlowSignature, Long> {
    List<DocumentFlowSignature> findAllByDocumentId(Long documentId);

    List<DocumentFlowSignature> findAllByRouteId(Long routeId);

    Optional<DocumentFlowSignature> findByAssignmentId(Long assignmentId);

    Optional<DocumentFlowSignature> findByRequestId(String requestId);
}
