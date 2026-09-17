package kz.eco.services.dto;

import kz.eco.content.dto.CaseStudySummaryDto;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.news.dto.NewsSeoDto;
import kz.eco.services.EcoService;

import java.time.Instant;
import java.util.List;

public record EcoServiceResponse(
        String id,
        String title,
        String category,
        String description,
        String forWhom,
        String result,
        List<String> includes,
        List<String> documents,
        List<String> workflow,
        String duration,
        String icon,
        String status,
        String reviewStatus,
        NewsAuthorDto author,
        NewsAuthorDto reviewer,
        Instant reviewedAt,
        Instant updatedAt,
        Long version,
        EcoServiceAeoDto aeo,
        List<CaseStudySummaryDto> relatedCases,
        NewsSeoDto seo
) {
    public static EcoServiceResponse from(EcoService entity, NewsAuthorDto author, NewsAuthorDto reviewer,
                                           List<CaseStudySummaryDto> relatedCases, NewsSeoDto seo) {
        return new EcoServiceResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getCategory().getLabel(),
                entity.getDescription(),
                entity.getForWhom(),
                entity.getResult(),
                List.copyOf(entity.getIncludes()),
                List.copyOf(entity.getDocuments()),
                List.copyOf(entity.getWorkflow()),
                entity.getDuration(),
                entity.getIcon(),
                entity.getContentStatus().name(),
                entity.getContentStatus().name(),
                author,
                reviewer,
                entity.getReviewedAt(),
                entity.getUpdatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant(),
                entity.getVersion(),
                EcoServiceAeoDto.from(entity),
                relatedCases,
                seo
        );
    }
}
