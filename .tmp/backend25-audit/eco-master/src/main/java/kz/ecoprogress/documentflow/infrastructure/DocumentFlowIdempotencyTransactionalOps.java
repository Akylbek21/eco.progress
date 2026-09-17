package kz.ecoprogress.documentflow.infrastructure;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** REQUIRES_NEW split-out, same reasoning as kz.eco.protocol.idempotency.
 *  ProtocolIdempotencyTransactionalOps - see that class's javadoc for why. */
@Service
public class DocumentFlowIdempotencyTransactionalOps {

    private final DocumentFlowIdempotencyRequestRepository repository;

    public DocumentFlowIdempotencyTransactionalOps(DocumentFlowIdempotencyRequestRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DocumentFlowIdempotencyRequest createProcessingRow(String scope, String idempotencyKey, String requestHash) {
        DocumentFlowIdempotencyRequest row = new DocumentFlowIdempotencyRequest();
        row.setScope(scope);
        row.setIdempotencyKey(idempotencyKey);
        row.setRequestHash(requestHash);
        row.setStatus(DocumentFlowIdempotencyStatus.PROCESSING);
        row.setCreatedAt(LocalDateTime.now());
        return repository.saveAndFlush(row);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DocumentFlowIdempotencyRequest resetForRetry(Long recordId) {
        DocumentFlowIdempotencyRequest row = repository.findById(recordId)
                .orElseThrow(() -> new IllegalStateException("Idempotency record " + recordId + " disappeared during retry reset"));
        row.setStatus(DocumentFlowIdempotencyStatus.PROCESSING);
        row.setCompletedAt(null);
        return repository.saveAndFlush(row);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long recordId) {
        repository.findById(recordId).ifPresent(row -> {
            row.setStatus(DocumentFlowIdempotencyStatus.FAILED);
            row.setCompletedAt(LocalDateTime.now());
            repository.saveAndFlush(row);
        });
    }
}
