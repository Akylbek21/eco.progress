package kz.ecoprogress.documentflow.infrastructure;

import kz.eco.common.exception.BadRequestException;

/** Same idempotency key reused with a different request body - always a client error. */
public class DocumentFlowIdempotencyKeyReusedException extends BadRequestException {
    public DocumentFlowIdempotencyKeyReusedException() {
        super("Idempotency-Key уже использовался с другим содержимым запроса", "IDEMPOTENCY_KEY_REUSED");
    }
}
