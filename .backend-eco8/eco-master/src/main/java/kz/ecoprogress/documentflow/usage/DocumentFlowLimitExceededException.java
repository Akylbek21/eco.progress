package kz.ecoprogress.documentflow.usage;

/**
 * Thrown by {@link UsageLimitService#checkAndReserve} when incrementing a metric would exceed the
 * organization's effective limit. Mapped to HTTP 409 CONFLICT by GlobalExceptionHandler (chosen
 * over 403: this is a transient, retryable-after-upgrade state tied to the current usage count,
 * not a permanent authorization decision - matching this app's existing convention of using 409
 * for "state conflict" errors like OPTIMISTIC_LOCK_CONFLICT).
 */
public class DocumentFlowLimitExceededException extends RuntimeException {

    private final UsageMetric metric;
    private final long limit;
    private final long current;

    public DocumentFlowLimitExceededException(UsageMetric metric, long limit, long current) {
        super("Превышен лимит тарифного плана: " + metric.name() + " (лимит " + limit + ", текущее значение " + current + ")");
        this.metric = metric;
        this.limit = limit;
        this.current = current;
    }

    public String code() {
        return metric.code();
    }

    public UsageMetric getMetric() { return metric; }
    public long getLimit() { return limit; }
    public long getCurrent() { return current; }
}
