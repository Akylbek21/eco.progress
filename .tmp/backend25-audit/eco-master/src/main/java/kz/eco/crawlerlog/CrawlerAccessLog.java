package kz.eco.crawlerlog;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** One row per confirmed AI/search-crawler hit (Infrastructure item 2) - never written for
 *  ordinary user traffic, see {@link CrawlerAccessLogFilter#detectCrawler(String)}. */
@Entity
@Table(name = "crawler_access_log")
public class CrawlerAccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String crawlerName;
    private String userAgent;
    private String requestUrl;
    private int statusCode;
    private long responseTimeMs;
    private Instant requestedAt;

    public Long getId() { return id; }
    public String getCrawlerName() { return crawlerName; }
    public void setCrawlerName(String crawlerName) { this.crawlerName = crawlerName; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public String getRequestUrl() { return requestUrl; }
    public void setRequestUrl(String requestUrl) { this.requestUrl = requestUrl; }
    public int getStatusCode() { return statusCode; }
    public void setStatusCode(int statusCode) { this.statusCode = statusCode; }
    public long getResponseTimeMs() { return responseTimeMs; }
    public void setResponseTimeMs(long responseTimeMs) { this.responseTimeMs = responseTimeMs; }
    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
}
