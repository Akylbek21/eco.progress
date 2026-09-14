package kz.ecoprogress.documentflow.access;

/** Subscription status is SUSPENDED - the module is fully closed (no read, no write) until an
 *  admin restores it. Mapped to HTTP 403. */
public class DocumentFlowAccessSuspendedException extends RuntimeException {

    public static final String CODE = "DOCUMENT_FLOW_ACCESS_SUSPENDED";

    public DocumentFlowAccessSuspendedException(String message) {
        super(message);
    }
}
