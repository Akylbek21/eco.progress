package kz.eco.common.exception;

import kz.eco.common.ApiFieldError;

import java.util.List;

public class ConflictException extends RuntimeException {

    private final String code;
    private final List<ApiFieldError> details;
    private final String resourceId;
    /** Set only via {@link #versionConflict(String, String, Long)}. */
    private Long currentVersion;

    public ConflictException(String message) {
        this(message, (String) null);
    }

    public ConflictException(String message, String code) {
        super(message);
        this.code = code;
        this.details = null;
        this.resourceId = null;
    }

    /** Conflict that points at the already-existing resource the caller should use instead (e.g.
     *  PROTOCOL_DRAFT_ALREADY_EXISTS -> the id of the draft that already covers the requirement).
     *  Surfaces as {@code fieldErrors.resourceId} in the error envelope. */
    public ConflictException(String message, String code, Object resourceId) {
        super(message);
        this.code = code;
        this.details = null;
        this.resourceId = resourceId == null ? null : String.valueOf(resourceId);
    }

    public String getResourceId() {
        return resourceId;
    }

    /**
     * Optimistic-locking conflict that also reports the resource's CURRENT version, so a client
     * that lost the race can re-issue its If-Match without an extra GET. Surfaces as
     * {@code fieldErrors.currentVersion} alongside the stable code; null when the version is not
     * available at the throw site.
     */
    public static ConflictException versionConflict(String message, String code, Long currentVersion) {
        ConflictException ex = new ConflictException(message, code);
        ex.currentVersion = currentVersion;
        return ex;
    }

    public Long getCurrentVersion() {
        return currentVersion;
    }

    /** Structured variant so a conflict (e.g. duplicate BIN) can surface as
     *  {@code errors: [{field, code, message}]} instead of a flat message list. */
    public ConflictException(String message, List<ApiFieldError> details) {
        super(message);
        this.details = details;
        this.code = details.size() == 1 ? details.getFirst().code() : "CONFLICT";
        this.resourceId = null;
    }

    public String getCode() {
        return code;
    }

    public List<ApiFieldError> getDetails() {
        return details;
    }
}
