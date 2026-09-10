package kz.eco.common.exception;

import kz.eco.common.ApiResponse;
import kz.eco.documentlibrary.CrmDocumentAccessDeniedException;
import kz.eco.documentlibrary.CrmDocumentStorageException;
import kz.eco.protocol.ProtocolImmutableException;
import kz.eco.protocol.SignedDocumentIntegrityException;
import kz.eco.storage.MongoConnectionFailures;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessSuspendedException;
import kz.ecoprogress.documentflow.access.DocumentFlowFeatureNotAvailableException;
import kz.ecoprogress.documentflow.access.DocumentFlowMembershipRequiredException;
import kz.ecoprogress.documentflow.access.DocumentFlowReadOnlyException;
import kz.ecoprogress.documentflow.access.DocumentFlowSubscriptionRequiredException;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
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
        HttpStatus status = "PEK_SETTINGS_VALIDATION_FAILED".equals(ex.getCode())
                ? HttpStatus.UNPROCESSABLE_ENTITY : HttpStatus.BAD_REQUEST;
        if (ex.getDetails() != null && !ex.getDetails().isEmpty()) {
            return ResponseEntity.status(status)
                    .body(ApiResponse.validationError(ex.getMessage(), ex.getDetails()));
        }
        return ResponseEntity.status(status)
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), ex.getFieldErrors()));
    }

    /** A required header (e.g. If-Match on optimistic-locked mutations - see PekController) is a
     *  client mistake, not a server error - must never fall through to the generic 500 handler. */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingRequestHeader(MissingRequestHeaderException ex) {
        String message = "Отсутствует обязательный заголовок: " + ex.getHeaderName();
        // A missing If-Match is specifically "you did not send a version", and PEK already returns
        // VERSION_REQUIRED for it on the paths that check the header by hand (permit file replace).
        // Emitting the same stable code here keeps one contract for the whole optimistic-locking
        // surface instead of two codes for the identical client mistake. HTTP status is unchanged.
        String code = "If-Match".equalsIgnoreCase(ex.getHeaderName()) ? "VERSION_REQUIRED" : "MISSING_REQUIRED_HEADER";
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(message, code, List.of(message)));
    }

    /** Same as above but for a required @RequestParam (e.g. companyId on the PEK scheduler's
     *  company-scoped run endpoint) - a client mistake, never a 500. */
    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingRequestParameter(
            org.springframework.web.bind.MissingServletRequestParameterException ex) {
        String message = "Отсутствует обязательный параметр: " + ex.getParameterName();
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(message, "MISSING_REQUIRED_PARAMETER", List.of(message)));
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
        if (ex.getCurrentVersion() != null) {
            // Optimistic-locking conflict: hand back the resource's current version (so the client
            // can retry with a correct If-Match) and a correlation id for the server-side log line.
            String traceId = newTraceId();
            log.info("Version conflict [traceId={}] code={} currentVersion={}", traceId, code, ex.getCurrentVersion());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error(ex.getMessage(), code,
                            Map.of("currentVersion", String.valueOf(ex.getCurrentVersion())), traceId));
        }
        if (ex.getResourceId() != null) {
            // Points the client at the resource that already exists (e.g. the draft protocol that
            // already covers this ПЭК requirement) so it can navigate there instead of retrying.
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error(ex.getMessage(), code, Map.of("resourceId", ex.getResourceId())));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), code, List.of(ex.getMessage())));
    }

    // --- kz.eco.documentlibrary module exceptions ---

    @ExceptionHandler(CrmDocumentAccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleCrmDocumentAccessDenied(CrmDocumentAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), List.of(ex.getMessage())));
    }

    @ExceptionHandler(CrmDocumentStorageException.class)
    public ResponseEntity<ApiResponse<Void>> handleCrmDocumentStorage(CrmDocumentStorageException ex) {
        String traceId = newTraceId();
        log.error("CRM document storage error [traceId={}]", traceId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Ошибка файлового хранилища", CrmDocumentStorageException.CODE,
                        Map.<String, String>of(), traceId));
    }

    @ExceptionHandler(kz.eco.signaturedoc.SignatureDocumentStorageException.class)
    public ResponseEntity<ApiResponse<Void>> handleSignatureDocumentStorage(kz.eco.signaturedoc.SignatureDocumentStorageException ex) {
        String traceId = newTraceId();
        log.error("Signature document storage error [traceId={}]", traceId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Ошибка файлового хранилища", kz.eco.signaturedoc.SignatureDocumentStorageException.CODE,
                        Map.<String, String>of(), traceId));
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

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocumentFlowForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), ex.getCode(), List.of(ex.getMessage())));
    }

    @ExceptionHandler({UnauthorizedException.class, BadCredentialsException.class})
    public ResponseEntity<ApiResponse<Void>> handleUnauthorized(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(ex.getMessage(), "UNAUTHORIZED", List.of(ex.getMessage())));
    }

    /** More specific than {@link #handleForbidden} so the ПЭК/protocol flows can return the stable
     *  {@code ACCESS_DENIED} code the frontend switches on, without changing the generic
     *  {@code FORBIDDEN} shape every other 403 in the API already returns. */
    @ExceptionHandler(ResourceAccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceAccessDenied(ResourceAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage(), ResourceAccessDeniedException.CODE,
                        List.of(ex.getMessage())));
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
    /** A NOT NULL / column-cannot-be-null failure is a schema/migration defect on the server side
     *  (the application code never set that column, but the DB still requires it) - it is never
     *  "a related record doesn't exist", so it must not be mislabeled REFERENCE_CONFLICT. That
     *  label actively misleads whoever's debugging it (client sent nothing wrong; there's no
     *  missing FK target) - see signature_documents.company_id, which stayed NOT NULL on some
     *  environments after the app stopped populating it. Distinguished from a real FK/unique
     *  violation so on-call can immediately tell "our schema is out of date" from "bad client
     *  data" without reading the stack trace. */
    private static final java.util.regex.Pattern NOT_NULL_VIOLATION = java.util.regex.Pattern.compile(
            "cannot be null|null not allowed|violates not-null constraint|doesn't have a default value",
            java.util.regex.Pattern.CASE_INSENSITIVE);

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        String traceId = java.util.UUID.randomUUID().toString().substring(0, 8);
        Throwable rootCause = org.springframework.core.NestedExceptionUtils.getMostSpecificCause(ex);
        String rootMessage = rootCause.getMessage() != null ? rootCause.getMessage() : "";
        if (NOT_NULL_VIOLATION.matcher(rootMessage).find()) {
            log.error("Schema constraint violation (NOT NULL column the application never set) "
                    + "[traceId={}]: rootCause={}", traceId, rootMessage, ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(
                            "Внутренняя ошибка сервера при сохранении записи. Сообщите администратору код " + traceId,
                            "SCHEMA_CONSTRAINT_VIOLATION", Map.<String, String>of(), traceId));
        }
        log.error("Data integrity violation [traceId={}]: rootCause={}", traceId, rootMessage, ex);
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
        String sqlState = null;
        Integer errorCode = null;
        if (rootCause instanceof java.sql.SQLException sqlEx) {
            sqlState = sqlEx.getSQLState();
            errorCode = sqlEx.getErrorCode();
        }
        log.error("Database schema error [traceId={}]: exception={}, sqlState={}, sqlErrorCode={}, rootCause={}",
                traceId, ex.getClass().getName(), sqlState, errorCode, rootCause.getMessage(), ex);
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
