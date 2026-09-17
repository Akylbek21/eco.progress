package kz.eco.protocol.idempotency;

/**
 * Lifecycle of a single {@code (userId, idempotencyKey)} idempotency record. Mapped as
 * {@code @Enumerated(STRING)} on {@link ProtocolIdempotencyRequest#status} rather than a raw
 * String, for compile-time safety in {@link ProtocolIdempotencyService}'s state machine.
 */
public enum ProtocolIdempotencyStatus {
    /** Row just created (or reset for retry); the underlying quick-create call is in flight. */
    PROCESSING,
    /** The quick-create call finished successfully; protocolId holds the resulting protocol id. */
    COMPLETED,
    /** The quick-create call threw; a retry with the same key+body is allowed and reuses this row. */
    FAILED
}
