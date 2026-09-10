package kz.eco.protocol.idempotency;

import kz.eco.common.exception.ConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Idempotency guard for POST /api/protocols/quick-create (and, in principle, any other
 * create-once endpoint that wants the same protection later). See the class-level state machine
 * in {@link #begin} for the full set of cases; V32__protocol_idempotency_requests.sql has the
 * schema and kz.eco.protocol.idempotency.ProtocolIdempotencyRequest the entity.
 *
 * Deliberately NOT wired into ProtocolController/ProtocolService by this change - see the
 * accompanying report for the exact call sites to paste in by hand.
 */
@Service
public class ProtocolIdempotencyService {

    private final ProtocolIdempotencyRequestRepository repository;
    private final ProtocolIdempotencyTransactionalOps transactionalOps;
    private final ObjectMapper objectMapper;

    public ProtocolIdempotencyService(ProtocolIdempotencyRequestRepository repository,
                                       ProtocolIdempotencyTransactionalOps transactionalOps,
                                       ObjectMapper objectMapper) {
        this.repository = repository;
        this.transactionalOps = transactionalOps;
        this.objectMapper = objectMapper;
    }

    /** Two-case result: either "go ahead and run the real operation" (recordId identifies the
     *  tracking row to later call complete()/fail() with - null means no key was supplied, i.e.
     *  idempotency tracking is a no-op for this call), or "don't run it again, here's the id of
     *  the protocol the original call already created". */
    public sealed interface IdempotencyOutcome permits Proceed, ReturnExisting {}

    public record Proceed(Long recordId) implements IdempotencyOutcome {}

    public record ReturnExisting(Long protocolId) implements IdempotencyOutcome {}

    /**
     * Call at the very start of the guarded operation, before doing any real work.
     *
     * State machine for a given (userId, idempotencyKey):
     *  - key null/blank            -> Proceed(null): feature is a no-op, no tracking row at all.
     *  - no row exists yet         -> insert a new PROCESSING row (racing concurrent inserts are
     *                                 resolved by re-fetching and re-evaluating below) -> Proceed(id).
     *  - row exists, hash mismatch -> IdempotencyKeyReusedException (400): same key, different
     *                                 request body - always an error regardless of status.
     *  - row exists, hash matches:
     *      - COMPLETED  -> ReturnExisting(protocolId): don't redo the work, hand back the result.
     *      - PROCESSING -> ConflictException/409 IDEMPOTENCY_KEY_IN_PROGRESS: a genuinely
     *                      concurrent duplicate is still running; caller should retry shortly
     *                      rather than racing a second attempt.
     *      - FAILED     -> reset the SAME row back to PROCESSING (deliberate exception to
     *                      "PROCESSING/COMPLETED aren't re-enterable" - a failed attempt must be
     *                      retryable) -> Proceed(id).
     */
    public IdempotencyOutcome begin(Long userId, String idempotencyKey, Object requestPayload) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return new Proceed(null);
        }
        String requestHash = hash(requestPayload);

        Optional<ProtocolIdempotencyRequest> existing = repository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (existing.isPresent()) {
            return evaluateExisting(existing.get(), requestHash);
        }

        try {
            ProtocolIdempotencyRequest created = transactionalOps.createProcessingRow(userId, idempotencyKey, requestHash);
            return new Proceed(created.getId());
        } catch (DataIntegrityViolationException concurrentInsertWon) {
            // Exactly the double-click race this feature exists to prevent: another request for
            // the same brand-new key inserted first. Re-fetch its row and evaluate it exactly as
            // if we had found it in the first place (most likely still PROCESSING -> 409, telling
            // the caller to retry, instead of a raw/generic 500 from the constraint violation).
            ProtocolIdempotencyRequest winner = repository.findByUserIdAndIdempotencyKey(userId, idempotencyKey)
                    .orElseThrow(() -> concurrentInsertWon);
            return evaluateExisting(winner, requestHash);
        }
    }

    private IdempotencyOutcome evaluateExisting(ProtocolIdempotencyRequest row, String requestHash) {
        if (!requestHash.equals(row.getRequestHash())) {
            throw new IdempotencyKeyReusedException();
        }
        return switch (row.getStatus()) {
            case COMPLETED -> new ReturnExisting(row.getProtocolId());
            case PROCESSING -> throw new ConflictException(
                    "Запрос с этим Idempotency-Key ещё обрабатывается, повторите попытку через несколько секунд",
                    "IDEMPOTENCY_KEY_IN_PROGRESS");
            case FAILED -> new Proceed(transactionalOps.resetForRetry(row.getId()).getId());
        };
    }

    /** Marks the tracking row COMPLETED with the resulting protocol id. Call right before
     *  returning from the guarded operation, on the success path only. No-op if recordId is null
     *  (no idempotency key was supplied for this call). Runs in the caller's own transaction (not
     *  REQUIRES_NEW) so it commits/rolls back atomically together with the rest of the operation -
     *  unlike fail(), there's no scenario where this needs to survive the caller rolling back. */
    public void complete(Long recordId, Long protocolId) {
        if (recordId == null) {
            return;
        }
        repository.findById(recordId).ifPresent(row -> {
            row.setStatus(ProtocolIdempotencyStatus.COMPLETED);
            row.setProtocolId(protocolId);
            row.setCompletedAt(LocalDateTime.now());
            repository.save(row);
        });
    }

    /** Marks the tracking row FAILED so a later retry with the same key can proceed. No-op if
     *  recordId is null. Must be called from the guarded operation's failure path (e.g. a
     *  try/finally or catch-rethrow around the body of quickCreate) - delegates to
     *  {@link ProtocolIdempotencyTransactionalOps#markFailed} so it commits in its own transaction
     *  even though the caller's transaction is rolling back. */
    public void fail(Long recordId) {
        if (recordId == null) {
            return;
        }
        transactionalOps.markFailed(recordId);
    }

    private String hash(Object requestPayload) {
        // "Good enough" determinism for a request DTO with Jackson's stable field order - no
        // field-sorting/canonicalization on top of that is attempted here, per spec.
        String json = objectMapper.writeValueAsString(requestPayload);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is a JDK-guaranteed algorithm (java.security.MessageDigest javadoc) - this
            // is unreachable in practice, but must be caught since the checked exception can't
            // otherwise propagate cleanly from a helper meant to be called with no ceremony.
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
