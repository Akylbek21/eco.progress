package kz.eco.normative;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory last-run status for {@link NormativeResourceSeeder}, so a startup import failure
 * (previously only visible as a log.warn line an operator had to go looking for) is observable
 * via GET /api/normatives/health as importStatus=FAILED + the offending source/error - without
 * introducing a persistent table for what is, today, a single-process best-effort startup step.
 * Not persisted across restarts by design: the next startup re-attempts the import anyway, so a
 * stale "FAILED" from a prior process would be misleading rather than useful.
 */
@Component
public class NormativeSeederStatusHolder {

    private final Map<String, String> failures = new ConcurrentHashMap<>();
    private volatile Instant lastRunAt;
    private volatile boolean anyAttempted;

    public void recordSuccess(String source) {
        anyAttempted = true;
        lastRunAt = Instant.now();
        failures.remove(source);
    }

    public void recordFailure(String source, String error) {
        anyAttempted = true;
        lastRunAt = Instant.now();
        failures.put(source, error == null ? "unknown error" : error);
    }

    public boolean hasFailures() {
        return !failures.isEmpty();
    }

    public boolean isAnyAttempted() {
        return anyAttempted;
    }

    public Instant lastRunAt() {
        return lastRunAt;
    }

    public Map<String, String> failuresSnapshot() {
        return new LinkedHashMap<>(failures);
    }
}
