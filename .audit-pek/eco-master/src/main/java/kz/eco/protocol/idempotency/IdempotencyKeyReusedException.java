package kz.eco.protocol.idempotency;

import kz.eco.common.exception.BadRequestException;

/**
 * Thrown when an Idempotency-Key that was already used for a request with a different body
 * (different SHA-256 request hash) is reused. Handled generically by GlobalExceptionHandler's
 * existing {@code BadRequestException} mapping (400, code from {@link #getCode()}) - no change to
 * GlobalExceptionHandler.java is needed.
 */
public class IdempotencyKeyReusedException extends BadRequestException {

    public IdempotencyKeyReusedException() {
        super("Этот Idempotency-Key уже использован для другого запроса", "IDEMPOTENCY_KEY_REUSED");
    }
}
