package kz.eco.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/** {@code errors} is deliberately {@code List<?>}, not {@code List<String>}: existing callers pass
 *  flat message strings (unchanged JSON: an array of strings), while structured-error callers
 *  (e.g. Companies validation) pass {@link ApiFieldError} records instead (JSON: an array of
 *  {field, code, message} objects) - both go through the same field without a parallel envelope
 *  type or a second "errors"-shaped property. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(T data, String message, boolean success, List<?> errors,
                              String code, Map<String, String> fieldErrors, String traceId) {

    public ApiResponse(T data, String message, boolean success) {
        this(data, message, success, null, null, null, null);
    }

    public ApiResponse(T data, String message, boolean success, List<?> errors) {
        this(data, message, success, errors, null, null, null);
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(data, null, true, null, null, null, null);
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(data, message, true, null, null, null, null);
    }

    public static <T> ApiResponse<T> error(String message, List<?> errors) {
        return new ApiResponse<>(null, message, false, errors, null, null, null);
    }

    /** Populates both error shapes at once: the flat {@code errors} list (existing consumers)
     * and {@code code}/{@code fieldErrors} (the per-field validation shape some sections need). */
    public static <T> ApiResponse<T> error(String message, String code, Map<String, String> fieldErrors) {
        List<String> errors = fieldErrors != null && !fieldErrors.isEmpty()
                ? List.copyOf(fieldErrors.values())
                : List.of(message);
        return new ApiResponse<>(null, message, false, errors, code, fieldErrors, null);
    }

    public static <T> ApiResponse<T> error(String message, String code, List<?> errors) {
        return new ApiResponse<>(null, message, false, errors, code, null, null);
    }

    /** Same as {@link #error(String, String, Map)} plus a server-generated trace id the caller can
     *  quote when reporting an opaque failure (e.g. a masked database-constraint conflict) - lets
     *  support correlate the response with the corresponding server log line without exposing
     *  SQL/constraint/table names to the client. */
    public static <T> ApiResponse<T> error(String message, String code, Map<String, String> fieldErrors, String traceId) {
        List<String> errors = fieldErrors != null && !fieldErrors.isEmpty()
                ? List.copyOf(fieldErrors.values())
                : List.of(message);
        return new ApiResponse<>(null, message, false, errors, code, fieldErrors, traceId);
    }

    /** Structured field errors (Companies contract): {@code errors} becomes an array of
     *  {field, code, message} objects instead of plain strings; {@code fieldErrors} is still
     *  populated (field -&gt; message) for any consumer that reads the map shape instead. */
    public static <T> ApiResponse<T> validationError(String message, List<ApiFieldError> details) {
        Map<String, String> fieldErrors = new java.util.LinkedHashMap<>();
        for (ApiFieldError detail : details) {
            fieldErrors.putIfAbsent(detail.field(), detail.message());
        }
        String code = details.size() == 1 ? details.getFirst().code() : "VALIDATION_ERROR";
        return new ApiResponse<>(null, message, false, details, code, fieldErrors, null);
    }

    /** Success-with-no-data response (e.g. "logout", "file deleted") - every existing caller uses
     *  this for an operation that actually succeeded, so success must be true here, not false. */
    public static <T> ApiResponse<T> message(String message) {
        return new ApiResponse<>(null, message, true, null, null, null, null);
    }
}
