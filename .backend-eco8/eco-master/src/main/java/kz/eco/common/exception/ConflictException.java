package kz.eco.common.exception;

import kz.eco.common.ApiFieldError;

import java.util.List;

public class ConflictException extends RuntimeException {

    private final String code;
    private final List<ApiFieldError> details;

    public ConflictException(String message) {
        this(message, (String) null);
    }

    public ConflictException(String message, String code) {
        super(message);
        this.code = code;
        this.details = null;
    }

    /** Structured variant so a conflict (e.g. duplicate BIN) can surface as
     *  {@code errors: [{field, code, message}]} instead of a flat message list. */
    public ConflictException(String message, List<ApiFieldError> details) {
        super(message);
        this.details = details;
        this.code = details.size() == 1 ? details.getFirst().code() : "CONFLICT";
    }

    public String getCode() {
        return code;
    }

    public List<ApiFieldError> getDetails() {
        return details;
    }
}
