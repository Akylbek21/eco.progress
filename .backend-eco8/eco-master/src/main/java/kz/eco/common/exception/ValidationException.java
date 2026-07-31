package kz.eco.common.exception;

import kz.eco.common.ApiFieldError;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Field-level validation failure. Carries a field -&gt; message map so the API can surface
 *  {@code fieldErrors} (e.g. {"minValue": "Минимум не может быть больше максимума"})
 *  alongside the flat {@code message}, per the module error-format contracts that need it.
 *  Callers that need the richer {field, code, message} shape (e.g. Companies) can instead pass a
 *  {@code List<ApiFieldError>}, from which the {@code fieldErrors} map is still derived
 *  automatically, so older map-only consumers keep working unchanged. */
public class ValidationException extends RuntimeException {

    private final String code;
    private final Map<String, String> fieldErrors;
    private final List<ApiFieldError> details;

    public ValidationException(String message, Map<String, String> fieldErrors) {
        this(message, "VALIDATION_ERROR", fieldErrors);
    }

    public ValidationException(String message, String code, Map<String, String> fieldErrors) {
        super(message);
        this.code = code;
        this.fieldErrors = fieldErrors;
        this.details = null;
    }

    public ValidationException(String message, List<ApiFieldError> details) {
        super(message);
        this.details = details;
        this.fieldErrors = toFieldErrorMap(details);
        this.code = details.size() == 1 ? details.getFirst().code() : "VALIDATION_ERROR";
    }

    private static Map<String, String> toFieldErrorMap(List<ApiFieldError> details) {
        Map<String, String> map = new LinkedHashMap<>();
        for (ApiFieldError detail : details) {
            map.putIfAbsent(detail.field(), detail.message());
        }
        return map;
    }

    public String getCode() {
        return code;
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }

    /** Non-null only when constructed from a {@code List<ApiFieldError>}. */
    public List<ApiFieldError> getDetails() {
        return details;
    }
}
