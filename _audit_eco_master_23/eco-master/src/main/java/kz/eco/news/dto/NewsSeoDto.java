package kz.eco.news.dto;

import java.util.Map;

/** Server-computed only - there is deliberately no request DTO field that lets a client set
 *  {@code robots}/{@code index}; it is always derived from {@link kz.eco.news.News#isIndexable()}. */
public record NewsSeoDto(String robots, String canonicalUrl, Map<String, Object> jsonLd) {
}
