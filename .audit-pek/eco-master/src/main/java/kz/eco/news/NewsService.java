package kz.eco.news;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.ContentStatus;
import kz.eco.content.ContentVersioning;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.news.dto.NewsResponse;
import kz.eco.news.dto.NewsSeoDto;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class NewsService {

    private final NewsRepository repository;
    private final UserRepository userRepository;
    private final NewsSeoService seoService;

    public NewsService(NewsRepository repository, UserRepository userRepository, NewsSeoService seoService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.seoService = seoService;
    }

    /** Public listing - only APPROVED/PUBLISHED material is ever exposed here, matching the "only
     *  reviewed material is publicly indexable" rule for the list surface too, not just single-item
     *  detail/sitemap. */
    @Transactional(readOnly = true)
    public List<NewsResponse> findAll() {
        return repository.findAllByReviewStatusInOrderByPublishedAtDesc(
                        List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED)).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Any status is servable by direct id (matches acceptance criteria: reviewed articles must be
     *  200/index,follow; unreviewed articles must be 200/noindex,follow and merely absent from the
     *  list/sitemap surfaces - not 404). robots/canonical/JSON-LD are always computed server-side. */
    @Transactional(readOnly = true)
    public NewsResponse findById(String id) {
        return repository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("Новость не найдена: " + id));
    }

    @Transactional
    public NewsResponse submitForReview(String id, Long version, User actor) {
        News news = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(news.getVersion(), version);
        requireTransition(news, ContentStatus.DRAFT, ContentStatus.IN_REVIEW);
        if (news.getAuthorId() == null) {
            news.setAuthorId(actor.getId());
        }
        news.setReviewStatus(ContentStatus.IN_REVIEW);
        return toResponse(repository.saveAndFlush(news));
    }

    @Transactional
    public NewsResponse returnForRevision(String id, Long version, String reason, User actor) {
        requireReason(reason);
        News news = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(news.getVersion(), version);
        requireTransition(news, ContentStatus.IN_REVIEW, ContentStatus.DRAFT);
        news.setReviewStatus(ContentStatus.DRAFT);
        return toResponse(repository.saveAndFlush(news));
    }

    @Transactional
    public NewsResponse approve(String id, Long version, User actor) {
        News news = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(news.getVersion(), version);
        requireTransition(news, ContentStatus.IN_REVIEW, ContentStatus.APPROVED);
        news.setReviewStatus(ContentStatus.APPROVED);
        news.setReviewerId(actor.getId());
        news.setReviewedAt(Instant.now());
        return toResponse(repository.saveAndFlush(news));
    }

    /** Refuses to publish unless reviewerId+reviewedAt+APPROVED are ALL already in place - the
     *  literal "нельзя публиковать без reviewerId, reviewedAt, APPROVED" rule, checked explicitly
     *  here rather than only relying on the state machine to have gotten it right upstream. */
    @Transactional
    public NewsResponse publish(String id, Long version, User actor) {
        News news = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(news.getVersion(), version);
        requireTransition(news, ContentStatus.APPROVED, ContentStatus.PUBLISHED);
        requireReviewed(news);
        news.setReviewStatus(ContentStatus.PUBLISHED);
        return toResponse(repository.saveAndFlush(news));
    }

    @Transactional
    public NewsResponse archive(String id, Long version, User actor) {
        News news = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(news.getVersion(), version);
        if (news.getReviewStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Архивировать можно только опубликованный материал", "NEWS_NOT_PUBLISHED");
        }
        news.setReviewStatus(ContentStatus.ARCHIVED);
        return toResponse(repository.saveAndFlush(news));
    }

    /** Revokes approval/publication - the article immediately loses indexability (sitemap
     *  exclusion + noindex,follow are both derived live from reviewStatus, so no separate flag
     *  needs clearing). reviewerId/reviewedAt are deliberately left in place as a historical
     *  record of who last reviewed it, not nulled out. */
    @Transactional
    public NewsResponse revokeApproval(String id, Long version, String reason, User actor) {
        requireReason(reason);
        News news = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(news.getVersion(), version);
        if (news.getReviewStatus() != ContentStatus.APPROVED && news.getReviewStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Статья не утверждена и не опубликована", "NEWS_NOT_APPROVED");
        }
        news.setReviewStatus(ContentStatus.IN_REVIEW);
        return toResponse(repository.saveAndFlush(news));
    }

    private News getOrThrow(String id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Новость не найдена: " + id));
    }

    private void requireTransition(News news, ContentStatus expected, ContentStatus target) {
        if (news.getReviewStatus() != expected) {
            throw new ConflictException(
                    "Недопустимый переход статуса: " + news.getReviewStatus() + " -> " + target,
                    "NEWS_INVALID_TRANSITION");
        }
    }

    private void requireReviewed(News news) {
        if (news.getReviewerId() == null || news.getReviewedAt() == null || news.getReviewStatus() != ContentStatus.APPROVED) {
            throw new ConflictException(
                    "Публикация невозможна без reviewerId, reviewedAt и статуса APPROVED", "NEWS_NOT_REVIEWED");
        }
    }

    private void requireReason(String reason) {
        if (reason == null || reason.trim().isBlank()) {
            throw new kz.eco.common.exception.BadRequestException("Укажите причину", "REASON_REQUIRED");
        }
    }

    private NewsResponse toResponse(News news) {
        NewsAuthorDto author = news.getAuthorId() == null ? null
                : userRepository.findById(news.getAuthorId()).map(NewsAuthorDto::from).orElse(null);
        NewsAuthorDto reviewer = news.getReviewerId() == null ? null
                : userRepository.findById(news.getReviewerId()).map(NewsAuthorDto::from).orElse(null);
        NewsSeoDto seo = new NewsSeoDto(
                seoService.robots(news),
                seoService.canonicalUrl(news),
                seoService.jsonLd(news, author, reviewer));
        return NewsResponse.from(news, author, reviewer, seo);
    }
}
