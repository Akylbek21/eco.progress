package kz.eco.common.exception;

import kz.eco.common.ApiResponse;
import kz.eco.protocol.ProtocolImmutableException;
import kz.eco.protocol.SignedDocumentIntegrityException;
import kz.eco.storage.MongoConnectionFailures;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessSuspendedException;
import kz.ecoprogress.documentflow.access.DocumentFlowFeatureNotAvailableException;
import kz.ecoprogress.documentflow.access.DocumentFlowMembershipRequiredException;
import kz.ecoprogress.documentflow.access.DocumentFlowReadOnlyException;
import kz.ecoprogress.documentflow.access.DocumentFlowSubscriptionRequiredException;
import kz.ecoprogress.documentflow.usage.DocumentFlowLimitExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(NotFoundException ex) {
        String code = ex.getCode() != null ? ex.getCode() : "NOT_FOUND";
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage(), code, List.of(ex.getMessage())));
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(ValidationException ex) {
        if (ex.getDetails() != null && !ex.getDetails().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.validationError(ex.getMessage(), ex.getDetails()));
        }
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), ex.getFieldErrors()));
    }

    /** A required header (e.g. If-Match on optimistic-locked mutations - see PekController) is a
     *  client mistake, not a server error - must never fall through to the generic 500 handler. */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingRequestHeader(MissingRequestHeaderException ex) {
        String message = "Отсутствует обязательный заголовок: " + ex.getHeaderName();
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(message, "MISSING_REQUIRED_HEADER", List.of(message)));
    }

    /** Module spec §5: a protocol whose status forbids the attempted action - never a plain 400/
     *  500, always this specific 409 with structured details so the frontend can show exactly
     *  which action was blocked and why, rather than a generic failure. */
    @ExceptionHandler(ProtocolImmutableException.class)
    public ResponseEntity<ApiResponse<Void>> handleProtocolImmutable(ProtocolImmutableException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), "PROTOCOL_IMMUTABLE", ex.getDetails()));
    }

    /** Module spec §6.8: the stored file backing a signed/immutable protocol is missing - this is
     *  a data-integrity problem, never something to paper over with an on-demand re-render (that
     *  would silently serve content that was never actually signed). */
    @ExceptionHandler(SignedDocumentIntegrityException.class)
    public ResponseEntity<ApiResponse<Void>> handleSignedDocumentIntegrity(SignedDocumentIntegrityException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), "SIGNED_DOCUMENT_INTEGRITY_ERROR", List.of(ex.getMessage())));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(BadRequestException ex) {
        String code = ex.getCode() != null ? ex.getCode() : "BAD_REQUEST";
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ex.getMessage(), code, List.of(ex.getMessage())));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiResponse<Void>> handleConflict(ConflictException ex) {
        if (ex.getDetails() != null && !ex.getDetails().isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.validationError(ex.getMessage(), ex.getDetails()));
        }
        String code = ex.getCode() != null ? ex.getCode() : "CONFLICT";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), code, List.of(ex.getMessage())));
    }

    // --- kz.ecoprogress.documentflow module exceptions ---

    @ExceptionHandler(DocumentFlowSubscriptionRequiredException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowSubscriptionRequired(DocumentFlowSubscriptionRequiredException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), DocumentFlowSubscriptionRequiredException.CODE, List.of(ex.getMessage())));
    }

    @ExceptionHandler(DocumentFlowAccessSuspendedException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowAccessSuspended(DocumentFlowAccessSuspendedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), DocumentFlowAccessSuspendedException.CODE, List.of(ex.getMessage())));
    }

    @ExceptionHandler(DocumentFlowMembershipRequiredException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowMembershipRequired(DocumentFlowMembershipRequiredException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), DocumentFlowMembershipRequiredException.CODE, List.of(ex.getMessage())));
    }

    @ExceptionHandler(DocumentFlowReadOnlyException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowReadOnly(DocumentFlowReadOnlyException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), DocumentFlowReadOnlyException.CODE, List.of(ex.getMessage())));
    }

    @ExceptionHandler(DocumentFlowFeatureNotAvailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowFeatureNotAvailable(DocumentFlowFeatureNotAvailableException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), ex.code(), List.of(ex.getMessage())));
    }

    @ExceptionHandler(DocumentFlowLimitExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowLimitExceeded(DocumentFlowLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), ex.code(), List.of(ex.getMessage())));
    }

    @ExceptionHandler({UnauthorizedException.class, BadCredentialsException.class})
    public ResponseEntity<ApiResponse<Void>> handleUnauthorized(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(ex.getMessage(), "UNAUTHORIZED", List.of(ex.getMessage())));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleForbidden(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Недостаточно прав", "FORBIDDEN", List.of("Недостаточно прав")));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("Некорректные данные", "VALIDATION_ERROR", fieldErrors));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Некорректный идентификатор", "BAD_REQUEST", List.of("Некорректный идентификатор")));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Не найдено", "NOT_FOUND", List.of("Не найдено")));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiResponse<Void>> handleMalformedRequest(Exception ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("Некорректный формат запроса", "BAD_REQUEST", List.of("Некорректный формат запроса")));
    }

    @ExceptionHandler(jakarta.persistence.EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleEntityNotFound(jakarta.persistence.EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Не найдено", "NOT_FOUND", List.of("Не найдено")));
    }

    /** JPA @Version mismatch detected at flush time (a genuine concurrent write from two
     * transactions both starting from the same version) - the manual pre-check in service methods
     * catches the common "stale client" case earlier with a friendlier message, but a real race
     * can still only be caught here, at the DB round-trip. */
    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(org.springframework.orm.ObjectOptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("Запись была изменена другим пользователем. Обновите страницу и повторите действие.",
                        "OPTIMISTIC_LOCK_CONFLICT", List.of("Обновите страницу и повторите действие")));
    }

    /** A constraint violation (unique/FK) surfacing all the way to this layer is always a client
     * data conflict, not a server bug - log the real cause for diagnostics but never echo raw
     * SQL/constraint text back to the client. */
    /**
     * Reaching this handler at all means a specific service didn't already classify the
     * violation into a targeted exception (e.g. ProtocolService's PROTOCOL_NUMBER_CONFLICT) - it's
     * the last-resort fallback, most often an FK reference to a row that no longer exists or isn't
     * accessible. Logs the real root cause (constraint/table detail) server-side with a traceId,
     * but the client only ever sees a generic, safe message plus that traceId to quote when
     * reporting the failure - never SQL, table, or constraint names.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        String traceId = java.util.UUID.randomUUID().toString().substring(0, 8);
        Throwable rootCause = org.springframework.core.NestedExceptionUtils.getMostSpecificCause(ex);
        log.error("Data integrity violation [traceId={}]: rootCause={}", traceId, rootCause.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("Одна из связанных записей не существует или недоступна",
                        "REFERENCE_CONFLICT", Map.<String, String>of(), traceId));
    }

    @ExceptionHandler({MultipartException.class, MaxUploadSizeExceededException.class})
    public ResponseEntity<ApiResponse<Void>> handleMultipartError(Exception ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("Некорректный файл или превышен максимальный размер",
                        "BAD_REQUEST", List.of("Некорректный файл или превышен максимальный размер")));
    }

    @ExceptionHandler(PayloadTooLargeException.class)
    public ResponseEntity<ApiResponse<Void>> handlePayloadTooLarge(PayloadTooLargeException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), List.of(ex.getMessage())));
    }

    /** A schema/SQL-shape problem (missing table/column, bad query, resource-usage error) reaching
     *  this layer is always a server-side defect, never something the client did wrong - log the
     *  real cause with a traceId so it can be diagnosed from the migrations/entities, but never
     *  echo SQL, table, or column names back to the client. Covers the "table exists per Flyway
     *  history but not physically" class of bug that otherwise surfaces as a bare 500. */
    @ExceptionHandler({org.hibernate.exception.SQLGrammarException.class,
            org.springframework.dao.InvalidDataAccessResourceUsageException.class,
            org.springframework.orm.jpa.JpaSystemException.class,
            org.springframework.transaction.TransactionSystemException.class})
    public ResponseEntity<ApiResponse<Void>> handleSchemaError(Exception ex) {
        String traceId = newTraceId();
        Throwable rootCause = org.springframework.core.NestedExceptionUtils.getMostSpecificCause(ex);
        log.error("Database schema error [traceId={}]: exception={}, rootCause={}",
                traceId, ex.getClass().getName(), rootCause.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Сервис временно недоступен из-за внутренней ошибки схемы данных",
                        "INTERNAL_SCHEMA_ERROR", Map.<String, String>of(), traceId));
    }

    /** A transient contention error (lock wait timeout / deadlock victim) is retryable by the
     *  client, unlike a genuine data conflict - surfaced as 409 so the UI can offer "try again"
     *  rather than treating it as a permanent failure. */
    @ExceptionHandler({org.springframework.dao.CannotAcquireLockException.class,
            org.springframework.dao.PessimisticLockingFailureException.class})
    public ResponseEntity<ApiResponse<Void>> handleLockContention(Exception ex) {
        String traceId = newTraceId();
        log.error("Lock contention [traceId={}]: exception={}", traceId, ex.getClass().getName(), ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("Запись временно заблокирована другой операцией. Повторите попытку.",
                        "LOCK_CONTENTION", Map.<String, String>of(), traceId));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleAny(Exception ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
        if (isMongoUnavailable(msg, ex)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error(
                            "Файловое хранилище (MongoDB) недоступно. Проверьте контейнер mongo и перезапустите: docker compose up -d --build",
                            "SERVICE_UNAVAILABLE", List.of("MongoDB unavailable")));
        }
        String traceId = newTraceId();
        log.error("Unexpected error [traceId={}]", traceId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .header("X-Trace-ID", traceId)
                .body(ApiResponse.error("Внутренняя ошибка сервера", "INTERNAL_ERROR", Map.<String, String>of(), traceId));
    }

    private static String newTraceId() {
        return java.util.UUID.randomUUID().toString().substring(0, 8);
    }

    private static boolean isMongoUnavailable(String message, Exception ex) {
        return MongoConnectionFailures.isConnectionFailure(ex)
                || (message != null && MongoConnectionFailures.isConnectionFailure(new Exception(message)));
    }
}
