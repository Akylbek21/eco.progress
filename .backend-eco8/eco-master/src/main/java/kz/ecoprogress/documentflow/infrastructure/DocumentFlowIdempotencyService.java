package kz.ecoprogress.documentflow.infrastructure;

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
 * Generic idempotency guard, modeled exactly on kz.eco.protocol.idempotency.
 * ProtocolIdempotencyService's state machine, but scoped by an arbitrary {@code scope} string
 * (e.g. "document-flow-access-grant") instead of being hardcoded to one endpoint - reusable by
 * this foundation layer's admin access-grant endpoint and by Agents B/C for their own
 * create-once endpoints.
 */
@Service
public class DocumentFlowIdempotencyService {

    private final DocumentFlowIdempotencyRequestRepository repository;
    private final DocumentFlowIdempotencyTransactionalOps transactionalOps;
    private final ObjectMapper objectMapper;

    public DocumentFlowIdempotencyService(DocumentFlowIdempotencyRequestRepository repository,
                                           DocumentFlowIdempotencyTransactionalOps transactionalOps,
                                           ObjectMapper objectMapper) {
        this.repository = repository;
        this.transactionalOps = transactionalOps;
        this.objectMapper = objectMapper;
    }

    public sealed interface IdempotencyOutcome permits Proceed, ReturnExisting {}
    public record Proceed(Long recordId) implements IdempotencyOutcome {}
    public record ReturnExisting(Long resultId) implements IdempotencyOutcome {}

    /** See ProtocolIdempotencyService#begin for the exact state machine (same rules, generic scope). */
    public IdempotencyOutcome begin(String scope, String idempotencyKey, Object requestPayload) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return new Proceed(null);
        }
        String requestHash = hash(requestPayload);

        Optional<DocumentFlowIdempotencyRequest> existing = repository.findByScopeAndIdempotencyKey(scope, idempotencyKey);
        if (existing.isPresent()) {
            return evaluateExisting(existing.get(), requestHash);
        }
        try {
            DocumentFlowIdempotencyRequest created = transactionalOps.createProcessingRow(scope, idempotencyKey, requestHash);
            return new Proceed(created.getId());
        } catch (DataIntegrityViolationException concurrentInsertWon) {
            DocumentFlowIdempotencyRequest winner = repository.findByScopeAndIdempotencyKey(scope, idempotencyKey)
                    .orElseThrow(() -> concurrentInsertWon);
            return evaluateExisting(winner, requestHash);
        }
    }

    private IdempotencyOutcome evaluateExisting(DocumentFlowIdempotencyRequest row, String requestHash) {
        if (!requestHash.equals(row.getRequestHash())) {
            throw new DocumentFlowIdempotencyKeyReusedException();
        }
        return switch (row.getStatus()) {
            case COMPLETED -> new ReturnExisting(row.getResultId());
            case PROCESSING -> throw new kz.eco.common.exception.ConflictException(
                    "Запрос с этим Idempotency-Key ещё обрабатывается, повторите попытку через несколько секунд",
                    "IDEMPOTENCY_KEY_IN_PROGRESS");
            case FAILED -> new Proceed(transactionalOps.resetForRetry(row.getId()).getId());
        };
    }

    public void complete(Long recordId, Long resultId) {
        if (recordId == null) return;
        repository.findById(recordId).ifPresent(row -> {
            row.setStatus(DocumentFlowIdempotencyStatus.COMPLETED);
            row.setResultId(resultId);
            row.setCompletedAt(LocalDateTime.now());
            repository.save(row);
        });
    }

    public void fail(Long recordId) {
        if (recordId == null) return;
        transactionalOps.markFailed(recordId);
    }

    private String hash(Object requestPayload) {
        String json = objectMapper.writeValueAsString(requestPayload);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
