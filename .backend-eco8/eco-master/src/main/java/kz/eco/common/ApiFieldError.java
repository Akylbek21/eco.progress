package kz.eco.common;

/** Structured per-field validation/conflict error: {@code {"field": "bin", "code": "DUPLICATE_BIN",
 *  "message": "..."}}. Named ApiFieldError (not FieldError) to avoid colliding with Spring's own
 *  {@link org.springframework.validation.FieldError}, which GlobalExceptionHandler also imports. */
public record ApiFieldError(String field, String code, String message) {
}
