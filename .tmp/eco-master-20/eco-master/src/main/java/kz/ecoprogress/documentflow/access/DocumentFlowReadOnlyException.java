package kz.ecoprogress.documentflow.access;

/** Subscription is EXPIRED/CANCELLED - read access remains, writes are blocked. Mapped to HTTP 409
 *  (a state conflict the client can resolve by renewing, not a permanent 403). */
public class DocumentFlowReadOnlyException extends RuntimeException {

    public static final String CODE = "DOCUMENT_FLOW_READ_ONLY";

    public DocumentFlowReadOnlyException(String message) {
        super(message);
    }
}
