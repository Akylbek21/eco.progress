package kz.eco.content;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.dto.CityFormsDto;
import kz.eco.content.dto.RelatedArticleDto;
import kz.eco.content.dto.ServiceCityPageResponse;
import kz.eco.news.News;
import kz.eco.news.NewsRepository;
import kz.eco.news.NewsSeoService;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.services.EcoServiceRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class ServiceCityPageService {

    /** How many indexable articles to surface for internal linking - a fixed small number, not
     *  every APPROVED article, so the block stays genuinely relevant. */
    private static final int MAX_RELATED_ARTICLES = 3;

    private final ServiceCityPageRepository pageRepository;
    private final CityRepository cityRepository;
    private final EcoServiceRepository serviceRepository;
    private final UserRepository userRepository;
    private final NewsRepository newsRepository;
    private final NewsSeoService newsSeoService;
    private final ServiceCityContentQualityService qualityService;
    private final ServiceCitySeoService seoService;
    private final CaseStudyService caseStudyService;

    public ServiceCityPageService(ServiceCityPageRepository pageRepository, CityRepository cityRepository,
                                   EcoServiceRepository serviceRepository, UserRepository userRepository,
                                   NewsRepository newsRepository, NewsSeoService newsSeoService,
                                   ServiceCityContentQualityService qualityService, ServiceCitySeoService seoService,
                                   CaseStudyService caseStudyService) {
        this.pageRepository = pageRepository;
        this.cityRepository = cityRepository;
        this.serviceRepository = serviceRepository;
        this.userRepository = userRepository;
        this.newsRepository = newsRepository;
        this.newsSeoService = newsSeoService;
        this.qualityService = qualityService;
        this.seoService = seoService;
        this.caseStudyService = caseStudyService;
    }

    /** Any status is servable by direct id, same reasoning as News: reviewed pages must be
     *  200/index,follow, unreviewed ones must be 200/noindex,follow, never 404. */
    @Transactional(readOnly = true)
    public ServiceCityPageResponse findByServiceAndCity(String serviceId, String citySlug) {
        return toResponse(getOrThrow(serviceId, citySlug));
    }

    /** Public listing for a service - only indexable pages, matching the "only reviewed material
     *  is publicly surfaced" rule applied to News' list endpoint too. */
    @Transactional(readOnly = true)
    public List<ServiceCityPageResponse> findIndexableForService(String serviceId) {
        return pageRepository.findAllByServiceId(serviceId).stream()
                .filter(ServiceCityPage::isIndexable)
                .map(this::toResponse)
                .toList();
    }

    /** Region hub: every indexable page for a given city, across all services. */
    @Transactional(readOnly = true)
    public List<ServiceCityPageResponse> findIndexableForCity(String citySlug) {
        return pageRepository.findAllByCitySlug(citySlug).stream()
                .filter(ServiceCityPage::isIndexable)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceCityPageResponse checkQuality(String serviceId, String citySlug) {
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        qualityService.check(page);
        return toResponse(pageRepository.saveAndFlush(page));
    }

    @Transactional
    public ServiceCityPageResponse submitForReview(String serviceId, String citySlug, Long version, User actor) {
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        ContentVersioning.requireCurrentVersion(page.getVersion(), version);
        requireTransition(page, ContentStatus.DRAFT, ContentStatus.IN_REVIEW);
        if (page.getAuthorId() == null) {
            page.setAuthorId(actor.getId());
        }
        page.setContentStatus(ContentStatus.IN_REVIEW);
        return toResponse(pageRepository.saveAndFlush(page));
    }

    @Transactional
    public ServiceCityPageResponse returnForRevision(String serviceId, String citySlug, Long version, String reason, User actor) {
        requireReason(reason);
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        ContentVersioning.requireCurrentVersion(page.getVersion(), version);
        requireTransition(page, ContentStatus.IN_REVIEW, ContentStatus.DRAFT);
        page.setContentStatus(ContentStatus.DRAFT);
        return toResponse(pageRepository.saveAndFlush(page));
    }

    /** Refuses to approve unless the quality check - re-run right here, never trusted from a stale
     *  field - actually passes. This is the enforcement point for "нельзя опубликовать
     *  индексируемую city page" if any of the quality rules fail. */
    @Transactional
    public ServiceCityPageResponse approve(String serviceId, String citySlug, Long version, User actor) {
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        ContentVersioning.requireCurrentVersion(page.getVersion(), version);
        requireTransition(page, ContentStatus.IN_REVIEW, ContentStatus.APPROVED);
        requireQualityPassed(page);
        page.setContentStatus(ContentStatus.APPROVED);
        page.setReviewerId(actor.getId());
        page.setReviewedAt(Instant.now());
        return toResponse(pageRepository.saveAndFlush(page));
    }

    /** Refuses to publish unless reviewerId+reviewedAt+APPROVED are already in place AND the
     *  quality check still passes - matches the unified CMS rule applied identically in
     *  NewsService#publish. */
    @Transactional
    public ServiceCityPageResponse publish(String serviceId, String citySlug, Long version, User actor) {
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        ContentVersioning.requireCurrentVersion(page.getVersion(), version);
        requireTransition(page, ContentStatus.APPROVED, ContentStatus.PUBLISHED);
        requireReviewed(page);
        requireQualityPassed(page);
        page.setContentStatus(ContentStatus.PUBLISHED);
        return toResponse(pageRepository.saveAndFlush(page));
    }

    @Transactional
    public ServiceCityPageResponse archive(String serviceId, String citySlug, Long version, User actor) {
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        ContentVersioning.requireCurrentVersion(page.getVersion(), version);
        if (page.getContentStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Архивировать можно только опубликованную страницу", "CITY_CONTENT_NOT_PUBLISHED");
        }
        page.setContentStatus(ContentStatus.ARCHIVED);
        return toResponse(pageRepository.saveAndFlush(page));
    }

    /** Unpublishes AND drops back to IN_REVIEW in one call - covers both "снятие approval" and
     *  "возврат страницы на доработку" for a page that was already live, immediately dropping it
     *  from the sitemap/making it noindex,follow (both computed live from these two fields). */
    @Transactional
    public ServiceCityPageResponse revokeApproval(String serviceId, String citySlug, Long version, String reason, User actor) {
        requireReason(reason);
        ServiceCityPage page = getOrThrow(serviceId, citySlug);
        ContentVersioning.requireCurrentVersion(page.getVersion(), version);
        if (page.getContentStatus() != ContentStatus.APPROVED && page.getContentStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Страница не утверждена", "CITY_CONTENT_NOT_APPROVED");
        }
        page.setContentStatus(ContentStatus.IN_REVIEW);
        return toResponse(pageRepository.saveAndFlush(page));
    }

    private ServiceCityPage getOrThrow(String serviceId, String citySlug) {
        return pageRepository.findByServiceIdAndCitySlug(serviceId, citySlug)
                .orElseThrow(() -> new NotFoundException(
                        "Страница не найдена: " + serviceId + "/" + citySlug, "SERVICE_CITY_PAGE_NOT_FOUND"));
    }

    private void requireQualityPassed(ServiceCityPage page) {
        boolean passed = qualityService.check(page);
        if (!passed) {
            throw new ConflictException(
                    "Контент не прошёл проверку качества: " + String.join("; ", page.getQualityIssues()),
                    "CITY_CONTENT_QUALITY_FAILED");
        }
    }

    private void requireReviewed(ServiceCityPage page) {
        if (page.getReviewerId() == null || page.getReviewedAt() == null || page.getContentStatus() != ContentStatus.APPROVED) {
            throw new ConflictException(
                    "Публикация невозможна без reviewerId, reviewedAt и статуса APPROVED", "CITY_CONTENT_NOT_REVIEWED");
        }
    }

    private void requireTransition(ServiceCityPage page, ContentStatus expected, ContentStatus target) {
        if (page.getContentStatus() != expected) {
            throw new ConflictException(
                    "Недопустимый переход статуса: " + page.getContentStatus() + " -> " + target,
                    "CITY_CONTENT_INVALID_TRANSITION");
        }
    }

    private void requireReason(String reason) {
        if (reason == null || reason.trim().isBlank()) {
            throw new BadRequestException("Укажите причину", "REASON_REQUIRED");
        }
    }

    private ServiceCityPageResponse toResponse(ServiceCityPage page) {
        City city = cityRepository.findById(page.getCitySlug()).orElse(null);
        CityFormsDto cityDto = city == null ? null : CityFormsDto.from(city);
        NewsAuthorDto author = page.getAuthorId() == null ? null
                : userRepository.findById(page.getAuthorId()).map(NewsAuthorDto::from).orElse(null);
        NewsAuthorDto reviewer = page.getReviewerId() == null ? null
                : userRepository.findById(page.getReviewerId()).map(NewsAuthorDto::from).orElse(null);
        return ServiceCityPageResponse.from(page, cityDto, author, reviewer, relatedArticles(),
                caseStudyService.findRelatedForCity(page.getCitySlug()),
                seoService.seo(page, serviceRepository.findById(page.getServiceId()).orElse(null), city));
    }

    /** Only ever pulls APPROVED/PUBLISHED (indexable) articles - an indexable city page must never
     *  link to a noindex article, and any article that regains APPROVED status is automatically
     *  eligible again since this is computed live on every read, never cached. */
    private List<RelatedArticleDto> relatedArticles() {
        return newsRepository.findAllByReviewStatusInOrderByPublishedAtDesc(
                        List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED)).stream()
                .limit(MAX_RELATED_ARTICLES)
                .map(this::toRelatedArticle)
                .toList();
    }

    private RelatedArticleDto toRelatedArticle(News news) {
        return new RelatedArticleDto(news.getId(), news.getTitle(), newsSeoService.canonicalUrl(news));
    }
}
