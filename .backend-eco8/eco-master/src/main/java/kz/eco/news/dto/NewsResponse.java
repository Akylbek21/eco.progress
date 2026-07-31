package kz.eco.news.dto;

import kz.eco.news.News;

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
        List<String> content
) {
    private static final DateTimeFormatter RU_DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ru-RU"));

    public static NewsResponse from(News entity) {
        return new NewsResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getExcerpt(),
                entity.getCategory(),
                entity.getPublishedAt() == null ? null : entity.getPublishedAt().format(RU_DATE),
                entity.getImage(),
                List.copyOf(entity.getContent())
        );
    }
}
