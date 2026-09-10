package kz.eco.content;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.dto.CaseStudyResponse;
import kz.eco.content.dto.CaseStudySummaryDto;
import kz.eco.content.dto.CreateCaseStudyRequest;
import kz.eco.content.dto.UpdateCaseStudyRequest;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** CaseStudy CMS: DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED (kz.eco.content.
 *  ContentStatus), same shape as News/EcoService/ServiceCityPage. "Публикация только после
 *  экспертной проверки" is requireReviewed() below, identical to the other content types -
 *  reviewerId+reviewedAt+APPROVED must already be in place before publish() will proceed. */
@Service
public class CaseStudyService {

    private static final int MAX_RELATED_CASES = 3;

    private final CaseStudyRepository repository;
    private final UserRepository userRepository;
    private final CaseStudySeoService seoService;

    public CaseStudyService(CaseStudyRepository repository, UserRepository userRepository, CaseStudySeoService seoService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.seoService = seoService;
    }

    @Transactional(readOnly = true)
    public List<CaseStudyResponse> findAllIndexable() {
        return repository.findAllByContentStatusInOrderByUpdatedAtDesc(
                        List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED)).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CaseStudyResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<CaseStudyResponse> findAllForAdmin() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    /** Real, published cases only - never a fabricated placeholder ("никакие фиктивные кейсы...
     *  не публикуются" is enforced by the review gate itself, not by this method, but this method
     *  is what guarantees only genuinely reviewed cases are ever suggested as "related"). */
    @Transactional(readOnly = true)
    public List<CaseStudySummaryDto> findRelatedForService(String serviceId) {
        return repository.findAllByServiceIdAndContentStatusIn(serviceId, List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED))
                .stream().filter(CaseStudy::isIndexable).limit(MAX_RELATED_CASES)
                .map(c -> CaseStudySummaryDto.from(c, seoService.canonicalUrl(c)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CaseStudySummaryDto> findRelatedForCity(String citySlug) {
        return repository.findAllByCitySlugAndContentStatusIn(citySlug, List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED))
                .stream().filter(CaseStudy::isIndexable).limit(MAX_RELATED_CASES)
                .map(c -> CaseStudySummaryDto.from(c, seoService.canonicalUrl(c)))
                .toList();
    }

    @Transactional
    public CaseStudyResponse create(CreateCaseStudyRequest request, User actor) {
        if (request.id() == null || request.id().isBlank()) {
            throw new BadRequestException("Укажите id (slug) кейса", "CASE_ID_REQUIRED");
        }
        if (repository.existsById(request.id())) {
            throw new ConflictException("Кейс с таким id уже существует", "CASE_ALREADY_EXISTS");
        }
        CaseStudy c = new CaseStudy();
        c.setId(request.id());
        applyFields(c, request.title(), request.summary(), request.clientLabel(), request.serviceId(),
                request.citySlug(), request.industry(), request.objectType(),
                request.challenge(), request.solution(), request.results(), request.image(), request.publishedAt());
        c.setAuthorId(actor.getId());
        return toResponse(repository.saveAndFlush(c));
    }

    /** Only while DRAFT - once submitted for review, content must go through returnForRevision()
     *  first (matching the same "no silent edits after review starts" convention as the other
     *  content types' workflow-vs-content-editing separation). */
    @Transactional
    public CaseStudyResponse update(String id, UpdateCaseStudyRequest request, User actor) {
        CaseStudy c = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(c.getVersion(), request.version());
        if (c.getContentStatus() != ContentStatus.DRAFT) {
            throw new ConflictException("Редактирование возможно только в статусе DRAFT", "CASE_NOT_EDITABLE");
        }
        applyFields(c, request.title(), request.summary(), request.clientLabel(), request.serviceId(),
                request.citySlug(), request.industry(), request.objectType(),
                request.challenge(), request.solution(), request.results(), request.image(), request.publishedAt());
        return toResponse(repository.saveAndFlush(c));
    }

    @Transactional
    public CaseStudyResponse submitForReview(String id, Long version, User actor) {
        CaseStudy c = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(c.getVersion(), version);
        requireTransition(c, ContentStatus.DRAFT, ContentStatus.IN_REVIEW);
        c.setContentStatus(ContentStatus.IN_REVIEW);
        return toResponse(repository.saveAndFlush(c));
    }

    @Transactional
    public CaseStudyResponse returnForRevision(String id, Long version, String reason, User actor) {
        requireReason(reason);
        CaseStudy c = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(c.getVersion(), version);
        requireTransition(c, ContentStatus.IN_REVIEW, ContentStatus.DRAFT);
        c.setContentStatus(ContentStatus.DRAFT);
        return toResponse(repository.saveAndFlush(c));
    }

    @Transactional
    public CaseStudyResponse approve(String id, Long version, User actor) {
        CaseStudy c = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(c.getVersion(), version);
        requireTransition(c, ContentStatus.IN_REVIEW, ContentStatus.APPROVED);
        c.setContentStatus(ContentStatus.APPROVED);
        c.setReviewerId(actor.getId());
        c.setReviewedAt(Instant.now());
        return toResponse(repository.saveAndFlush(c));
    }

    @Transactional
    public CaseStudyResponse publish(String id, Long version, User actor) {
        CaseStudy c = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(c.getVersion(), version);
        requireTransition(c, ContentStatus.APPROVED, ContentStatus.PUBLISHED);
        requireReviewed(c);
        c.setContentStatus(ContentStatus.PUBLISHED);
        return toResponse(repository.saveAndFlush(c));
    }

    @Transactional
    public CaseStudyResponse archive(String id, Long version, User actor) {
        CaseStudy c = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(c.getVersion(), version);
        if (c.getContentStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Архивировать можно только опубликованный кейс", "CASE_NOT_PUBLISHED");
        }
        c.setContentStatus(ContentStatus.ARCHIVED);
        return toResponse(repository.saveAndFlush(c));
    }

    private void applyFields(CaseStudy c, String title, String summary, String clientLabel, String serviceId,
                              String citySlug, String industry, String objectType,
                              String challenge, String solution, List<String> results, String image,
                              java.time.LocalDate publishedAt) {
        c.setTitle(title);
        c.setSummary(summary);
        c.setClientLabel(clientLabel);
        c.setServiceId(serviceId);
        c.setCitySlug(citySlug);
        c.setIndustry(industry);
        c.setObjectType(objectType);
        c.setChallenge(challenge);
        c.setSolution(solution);
        c.setResults(results == null ? new ArrayList<>() : new ArrayList<>(results));
        c.setImage(image);
        c.setPublishedAt(publishedAt);
    }

    private CaseStudy getOrThrow(String id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Кейс не найден: " + id, "CASE_NOT_FOUND"));
    }

    private void requireTransition(CaseStudy c, ContentStatus expected, ContentStatus target) {
        if (c.getContentStatus() != expected) {
            throw new ConflictException(
                    "Недопустимый переход статуса: " + c.getContentStatus() + " -> " + target,
                    "CASE_INVALID_TRANSITION");
        }
    }

    private void requireReviewed(CaseStudy c) {
        if (c.getReviewerId() == null || c.getReviewedAt() == null || c.getContentStatus() != ContentStatus.APPROVED) {
            throw new ConflictException(
                    "Публикация невозможна без reviewerId, reviewedAt и статуса APPROVED", "CASE_NOT_REVIEWED");
        }
    }

    private void requireReason(String reason) {
        if (reason == null || reason.trim().isBlank()) {
            throw new BadRequestException("Укажите причину", "REASON_REQUIRED");
        }
    }

    private CaseStudyResponse toResponse(CaseStudy c) {
        NewsAuthorDto author = c.getAuthorId() == null ? null
                : userRepository.findById(c.getAuthorId()).map(NewsAuthorDto::from).orElse(null);
        NewsAuthorDto reviewer = c.getReviewerId() == null ? null
                : userRepository.findById(c.getReviewerId()).map(NewsAuthorDto::from).orElse(null);
        return CaseStudyResponse.from(c, author, reviewer, seoService.seo(c));
    }
}
