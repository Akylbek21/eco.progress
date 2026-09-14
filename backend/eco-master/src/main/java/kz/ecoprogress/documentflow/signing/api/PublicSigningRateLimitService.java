package kz.ecoprogress.documentflow.signing.api;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;

@Service
public class PublicSigningRateLimitService {
    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int MAX_REQUESTS = 30;
    private final PublicSigningRateLimitRepository repository;

    public PublicSigningRateLimitService(PublicSigningRateLimitRepository repository) { this.repository = repository; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean allow(String keyHash) {
        Instant now = Instant.now();
        PublicSigningRateLimit row = repository.findForUpdate(keyHash).orElse(null);
        if (row == null) {
            row = new PublicSigningRateLimit();
            row.setKeyHash(keyHash); row.setWindowStart(now); row.setRequestCount(1);
            try { repository.saveAndFlush(row); return true; }
            catch (DataIntegrityViolationException race) { return false; }
        }
        if (row.getWindowStart().plus(WINDOW).isBefore(now)) {
            row.setWindowStart(now); row.setRequestCount(1); return true;
        }
        row.setRequestCount(row.getRequestCount() + 1);
        return row.getRequestCount() <= MAX_REQUESTS;
    }

    @Transactional
    public void cleanup() { repository.deleteExpired(Instant.now().minus(Duration.ofMinutes(10))); }
}
