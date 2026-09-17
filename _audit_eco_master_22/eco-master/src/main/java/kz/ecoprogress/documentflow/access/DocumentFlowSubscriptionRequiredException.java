package kz.ecoprogress.documentflow.access;

/** No subscription at all, or subscription is still PENDING. Mapped to HTTP 403 by
 *  GlobalExceptionHandler - chosen over 402 for consistency with the rest of this app's error
 *  codes, which don't otherwise use payment-required semantics anywhere. */
public class DocumentFlowSubscriptionRequiredException extends RuntimeException {

    public static final String CODE = "DOCUMENT_FLOW_SUBSCRIPTION_REQUIRED";

    public DocumentFlowSubscriptionRequiredException(String message) {
        super(message);
    }
}
