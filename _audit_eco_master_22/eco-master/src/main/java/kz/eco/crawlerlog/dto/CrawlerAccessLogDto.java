package kz.eco.crawlerlog.dto;

import kz.eco.crawlerlog.CrawlerAccessLog;

import java.time.Instant;

public record CrawlerAccessLogDto(
        Long id,
        String crawlerName,
        String userAgent,
        String url,
        int status,
        long responseTimeMs,
        Instant timestamp
) {
    public static CrawlerAccessLogDto from(CrawlerAccessLog log) {
        return new CrawlerAccessLogDto(log.getId(), log.getCrawlerName(), log.getUserAgent(),
                log.getRequestUrl(), log.getStatusCode(), log.getResponseTimeMs(), log.getRequestedAt());
    }
}
