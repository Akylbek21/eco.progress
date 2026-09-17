package kz.eco.content.dto;

import kz.eco.content.CaseStudy;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.news.dto.NewsSeoDto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record CaseStudyResponse(
        String id,
        /** Semantic alias for id — the slug used in canonical URLs. Same value as id. */
        String slug,
        String title,
        String summary,
        String clientLabel,
        String serviceId,
        /** Semantic alias for serviceId — for FE contract clarity. */
        String service,
        String citySlug,
        String industry,
        String objectType,
        String challenge,
        /** Semantic alias for challenge. */
        String problem,
        String solution,
        /** Semantic alias for solution. */
        String workPerformed,
        List<String> results,
        String image,
        String status,
        String reviewStatus,
        NewsAuthorDto author,
        NewsAuthorDto reviewer,
        Instant reviewedAt,
        /** Date the case study was formally published (set by editor at approval time). */
        LocalDate publishedAt,
        Instant updatedAt,
        Long version,
        NewsSeoDto seo
) {
    public static CaseStudyResponse from(CaseStudy c, NewsAuthorDto author, NewsAuthorDto reviewer, NewsSeoDto seo) {
        String statusName = c.getContentStatus().name();
        return new CaseStudyResponse(
                c.getId(),
                c.getId(),           // slug == id
                c.getTitle(),
                c.getSummary(),
                c.getClientLabel(),
                c.getServiceId(),
                c.getServiceId(),    // service == serviceId
                c.getCitySlug(),
                c.getIndustry(),
                c.getObjectType(),
                c.getChallenge(),
                c.getChallenge(),    // problem == challenge
                c.getSolution(),
                c.getSolution(),     // workPerformed == solution
                List.copyOf(c.getResults()),
                c.getImage(),
                statusName,
                statusName,
                author,
                reviewer,
                c.getReviewedAt(),
                c.getPublishedAt(),
                c.getUpdatedAt(),
                c.getVersion(),
                seo
        );
    }
}
