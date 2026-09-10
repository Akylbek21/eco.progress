package kz.eco.common.exception;

/**
 * 403 with the stable error code {@code ACCESS_DENIED} (plus, optionally, which resource was
 * refused). A subclass of Spring's {@link org.springframework.security.access.AccessDeniedException}
 * so every existing catch/handler keeps working; {@code GlobalExceptionHandler} has a dedicated,
 * more specific handler for it so the generic 403 shape ({@code code: "FORBIDDEN"}) used by the
 * rest of the API is left untouched.
 */
public class ResourceAccessDeniedException extends org.springframework.security.access.AccessDeniedException {

    public static final String CODE = "ACCESS_DENIED";

    public ResourceAccessDeniedException(String message) {
        super(message);
    }
}
