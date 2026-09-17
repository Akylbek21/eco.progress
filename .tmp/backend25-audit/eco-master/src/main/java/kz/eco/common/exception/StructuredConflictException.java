package kz.eco.common.exception;

import java.util.List;

/**
 * A 409 whose {@code errors} array carries structured items (records serialised as objects) under a
 * stable {@code code}, for conflicts that are a list of things to fix rather than one message - e.g.
 * PEK_PACKAGE_NOT_READY with one {code, section, entityId, field, message} per missing document.
 */
public class StructuredConflictException extends RuntimeException {

    private final String code;
    private final List<?> items;

    public StructuredConflictException(String message, String code, List<?> items) {
        super(message);
        this.code = code;
        this.items = List.copyOf(items);
    }

    public String getCode() {
        return code;
    }

    public List<?> getItems() {
        return items;
    }
}
