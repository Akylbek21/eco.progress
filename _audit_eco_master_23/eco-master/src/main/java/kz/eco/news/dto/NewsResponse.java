package kz.eco.news.dto;

import kz.eco.news.News;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

public record NewsResponse(
        String id,
        String title,
        String excerpt,
        String category,
        String date,
        String image,
        List<String> content,
        /** Cited sources - URLs or descriptive text rendered as visible <cite> elements. Empty
         *  list for legacy articles that predate this field. Never null. */
        List<String> sources,
        // Unified CMS contract (kz.eco.content.ContentStatus): status/reviewStatus deliberately
        // mirror the same underlying value - "status" is the field name the public consumer
        // contract asks for, "reviewStatus" is the explicit workflow name.
        String status,
        String reviewStatus,
        String publishedAtIso,
        Instant reviewedAt,
        NewsAuthorDto author,
        NewsAuthorDto reviewer,
        Instant updatedAt,
        Long version,
        NewsSeoDto seo
) {
    private static final DateTimeFormatter RU_DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ru-RU"));

    public static NewsResponse from(News entity, NewsAuthorDto author, NewsAuthorDto reviewer, NewsSeoDto seo) {
        return new NewsResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getExcerpt(),
                entity.getCategory(),
                entity.getPublishedAt() == null ? null : entity.getPublishedAt().format(RU_DATE),
                entity.getImage(),
                List.copyOf(entity.getContent()),
                List.copyOf(entity.getSources()),
                entity.getReviewStatus().name(),
                entity.getReviewStatus().name(),
                entity.getPublishedAt() == null ? null : entity.getPublishedAt().toString(),
                entity.getReviewedAt(),
                author,
                reviewer,
                entity.getUpdatedAt(),
                entity.getVersion(),
                seo
        );
    }
}
