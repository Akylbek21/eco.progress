package kz.eco.content.dto;

import kz.eco.content.ServiceCityPage;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.news.dto.NewsSeoDto;

import java.time.Instant;
import java.util.List;

/** Public service-city page contract - the minimum set required is: status/regionContentStatus,
 *  updatedAt, reviewedAt, regional text blocks, local FAQ, cases, city declension data, author,
 *  reviewer, version. status/regionContentStatus deliberately mirror the same unified
 *  kz.eco.content.ContentStatus value, matching News' public contract. */
public record ServiceCityPageResponse(
        Long id,
        String serviceId,
        String citySlug,
        String status,
        String regionContentStatus,
        boolean contentQualityPassed,
        List<String> qualityIssues,
        Instant reviewedAt,
        Instant updatedAt,
        NewsAuthorDto author,
        NewsAuthorDto reviewer,
        Long version,
        List<String> regionalBlocks,
        List<FaqItemDto> localFaq,
        List<String> cases,
        CityFormsDto city,
        List<RelatedArticleDto> relatedArticles,
        List<CaseStudySummaryDto> relatedCaseStudies,
        NewsSeoDto seo
) {
    public static ServiceCityPageResponse from(ServiceCityPage page, CityFormsDto city, NewsAuthorDto author,
                                                NewsAuthorDto reviewer, List<RelatedArticleDto> relatedArticles,
                                                List<CaseStudySummaryDto> relatedCaseStudies, NewsSeoDto seo) {
        return new ServiceCityPageResponse(
                page.getId(),
                page.getServiceId(),
                page.getCitySlug(),
                page.getContentStatus().name(),
                page.getContentStatus().name(),
                page.isContentQualityPassed(),
                List.copyOf(page.getQualityIssues()),
                page.getReviewedAt(),
                page.getUpdatedAt(),
                author,
                reviewer,
                page.getVersion(),
                List.copyOf(page.getRegionalBlocks()),
                page.getLocalFaq().stream().map(FaqItemDto::from).toList(),
                List.copyOf(page.getCases()),
                city,
                relatedArticles,
                relatedCaseStudies,
                seo
        );
    }
}
