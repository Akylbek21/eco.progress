package kz.ecoprogress.documentflow.access;

/** The (userId, organizationId) pair resolved to no membership row at all (or a REMOVED one) -
 *  the tenant-isolation guard: a user must never get module access to an organization they were
 *  never invited into, regardless of that organization's subscription state. Mapped to HTTP 403. */
public class DocumentFlowMembershipRequiredException extends RuntimeException {

    public static final String CODE = "DOCUMENT_FLOW_MEMBERSHIP_REQUIRED";

    public DocumentFlowMembershipRequiredException(String message) {
        super(message);
    }
}
