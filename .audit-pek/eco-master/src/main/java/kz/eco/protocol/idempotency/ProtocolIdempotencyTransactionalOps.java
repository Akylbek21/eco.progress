package kz.eco.protocol.idempotency;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Split into its own bean (not private methods on ProtocolIdempotencyService) so the REQUIRES_NEW
 * attempts below are invoked through the Spring AOP proxy - a self-invoked {@code @Transactional}
 * method on the same bean is silently NOT proxied, and the propagation setting would be ignored.
 * Same pattern as kz.eco.company.CompanyPrimaryObjectMaterializer /
 * LabJournalRowCounterService+LabJournalRowCounterTransactionalOps.
 *
 * Both methods here commit (or roll back) independently of whatever transaction the caller
 * (ProtocolService.quickCreate, itself @Transactional) is running in:
 *  - createProcessingRow must survive even if quickCreate's own transaction later rolls back,
 *    otherwise a failed attempt would leave no idempotency row behind at all, defeating the
 *    "don't double-create on retry" guarantee this whole feature exists for.
 *  - markFailed specifically runs *because* the caller's transaction is about to roll back (an
 *    exception in quickCreate) - if it weren't REQUIRES_NEW, marking the row FAILED would itself
 *    be rolled back, leaving it stuck at PROCESSING forever and permanently blocking retries.
 */
@Service
public class ProtocolIdempotencyTransactionalOps {

    private final ProtocolIdempotencyRequestRepository repository;

    public ProtocolIdempotencyTransactionalOps(ProtocolIdempotencyRequestRepository repository) {
        this.repository = repository;
    }

    /**
     * Inserts a brand-new PROCESSING row. If a concurrent request for the same
     * (userId, idempotencyKey) wins the race, this throws DataIntegrityViolationException (unique
     * constraint uk_protocol_idempotency) and only THIS nested transaction rolls back - the caller
     * (ProtocolIdempotencyService.begin) catches it and re-fetches the winner's row.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProtocolIdempotencyRequest createProcessingRow(Long userId, String idempotencyKey, String requestHash) {
        ProtocolIdempotencyRequest row = new ProtocolIdempotencyRequest();
        row.setUserId(userId);
        row.setIdempotencyKey(idempotencyKey);
        row.setRequestHash(requestHash);
        row.setStatus(ProtocolIdempotencyStatus.PROCESSING);
        row.setCreatedAt(LocalDateTime.now());
        return repository.saveAndFlush(row);
    }

    /**
     * Resets an existing FAILED row back to PROCESSING in place, for a legitimate retry with the
     * same key + same request body. Updates the same row rather than inserting a new one, since
     * uk_protocol_idempotency forbids a second row for the same (userId, idempotencyKey) anyway.
     * REQUIRES_NEW for the same reason as createProcessingRow: this must persist independently of
     * the caller's (quickCreate's) transaction outcome.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProtocolIdempotencyRequest resetForRetry(Long recordId) {
        ProtocolIdempotencyRequest row = repository.findById(recordId)
                .orElseThrow(() -> new IllegalStateException("Idempotency record " + recordId + " disappeared during retry reset"));
        row.setStatus(ProtocolIdempotencyStatus.PROCESSING);
        row.setCompletedAt(null);
        return repository.saveAndFlush(row);
    }

    /**
     * Marks a record FAILED in its own transaction that commits even though the caller
     * (ProtocolService.quickCreate) is unwinding after an exception and its own transaction will
     * roll back. See the class Javadoc.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long recordId) {
        repository.findById(recordId).ifPresent(row -> {
            row.setStatus(ProtocolIdempotencyStatus.FAILED);
            row.setCompletedAt(LocalDateTime.now());
            repository.saveAndFlush(row);
        });
    }
}
