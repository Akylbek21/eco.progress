package kz.ecoprogress.documentflow.signing.api;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "document_flow_public_rate_limits")
public class PublicSigningRateLimit {
    @Id
    @Column(name = "key_hash", length = 64)
    private String keyHash;
    @Column(name = "window_start", nullable = false)
    private Instant windowStart;
    @Column(name = "request_count", nullable = false)
    private int requestCount;
    @Version
    @Column(nullable = false)
    private long version;
    public String getKeyHash() { return keyHash; }
    public void setKeyHash(String keyHash) { this.keyHash = keyHash; }
    public Instant getWindowStart() { return windowStart; }
    public void setWindowStart(Instant windowStart) { this.windowStart = windowStart; }
    public int getRequestCount() { return requestCount; }
    public void setRequestCount(int requestCount) { this.requestCount = requestCount; }
}
