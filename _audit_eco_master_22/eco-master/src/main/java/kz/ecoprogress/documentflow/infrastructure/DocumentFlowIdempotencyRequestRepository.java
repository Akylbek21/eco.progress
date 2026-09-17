package kz.ecoprogress.documentflow.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DocumentFlowIdempotencyRequestRepository extends JpaRepository<DocumentFlowIdempotencyRequest, Long> {
    Optional<DocumentFlowIdempotencyRequest> findByScopeAndIdempotencyKey(String scope, String idempotencyKey);
}
