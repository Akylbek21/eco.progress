package kz.eco.services;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.CaseStudyService;
import kz.eco.content.ContentStatus;
import kz.eco.content.ContentVersioning;
import kz.eco.news.dto.NewsAuthorDto;
import kz.eco.services.dto.EcoServiceResponse;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class EcoServiceService {

    private final EcoServiceRepository repository;
    private final UserRepository userRepository;
    private final EcoServiceSeoService seoService;
    private final CaseStudyService caseStudyService;

    public EcoServiceService(EcoServiceRepository repository, UserRepository userRepository,
                              EcoServiceSeoService seoService, CaseStudyService caseStudyService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.seoService = seoService;
        this.caseStudyService = caseStudyService;
    }

    /** Public catalogue - only APPROVED/PUBLISHED (and active) services, matching the same
     *  reviewed-material-only rule as News/ServiceCityPage. */
    @Transactional(readOnly = true)
    public List<EcoServiceResponse> findAll() {
        return repository.findAllByIsActiveTrueAndContentStatusInOrderByTitleAsc(
                        List.of(ContentStatus.APPROVED, ContentStatus.PUBLISHED)).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EcoServiceResponse findById(String id) {
        return toResponse(getOrThrow(id));
    }

    @Transactional
    public EcoServiceResponse submitForReview(String id, Long version, User actor) {
        EcoService svc = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(svc.getVersion(), version);
        requireTransition(svc, ContentStatus.DRAFT, ContentStatus.IN_REVIEW);
        if (svc.getAuthorId() == null) {
            svc.setAuthorId(actor.getId());
        }
        svc.setContentStatus(ContentStatus.IN_REVIEW);
        return toResponse(repository.saveAndFlush(svc));
    }

    @Transactional
    public EcoServiceResponse returnForRevision(String id, Long version, String reason, User actor) {
        requireReason(reason);
        EcoService svc = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(svc.getVersion(), version);
        requireTransition(svc, ContentStatus.IN_REVIEW, ContentStatus.DRAFT);
        svc.setContentStatus(ContentStatus.DRAFT);
        return toResponse(repository.saveAndFlush(svc));
    }

    @Transactional
    public EcoServiceResponse approve(String id, Long version, User actor) {
        EcoService svc = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(svc.getVersion(), version);
        requireTransition(svc, ContentStatus.IN_REVIEW, ContentStatus.APPROVED);
        svc.setContentStatus(ContentStatus.APPROVED);
        svc.setReviewerId(actor.getId());
        svc.setReviewedAt(Instant.now());
        return toResponse(repository.saveAndFlush(svc));
    }

    @Transactional
    public EcoServiceResponse publish(String id, Long version, User actor) {
        EcoService svc = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(svc.getVersion(), version);
        requireTransition(svc, ContentStatus.APPROVED, ContentStatus.PUBLISHED);
        requireReviewed(svc);
        svc.setContentStatus(ContentStatus.PUBLISHED);
        return toResponse(repository.saveAndFlush(svc));
    }

    @Transactional
    public EcoServiceResponse archive(String id, Long version, User actor) {
        EcoService svc = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(svc.getVersion(), version);
        if (svc.getContentStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Архивировать можно только опубликованную услугу", "SERVICE_NOT_PUBLISHED");
        }
        svc.setContentStatus(ContentStatus.ARCHIVED);
        return toResponse(repository.saveAndFlush(svc));
    }

    @Transactional
    public EcoServiceResponse revokeApproval(String id, Long version, String reason, User actor) {
        requireReason(reason);
        EcoService svc = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(svc.getVersion(), version);
        if (svc.getContentStatus() != ContentStatus.APPROVED && svc.getContentStatus() != ContentStatus.PUBLISHED) {
            throw new ConflictException("Услуга не утверждена", "SERVICE_NOT_APPROVED");
        }
        svc.setContentStatus(ContentStatus.IN_REVIEW);
        return toResponse(repository.saveAndFlush(svc));
    }

    private EcoService getOrThrow(String id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Услуга не найдена: " + id));
    }

    private void requireTransition(EcoService svc, ContentStatus expected, ContentStatus target) {
        if (svc.getContentStatus() != expected) {
            throw new ConflictException(
                    "Недопустимый переход статуса: " + svc.getContentStatus() + " -> " + target,
                    "SERVICE_INVALID_TRANSITION");
        }
    }

    private void requireReviewed(EcoService svc) {
        if (svc.getReviewerId() == null || svc.getReviewedAt() == null || svc.getContentStatus() != ContentStatus.APPROVED) {
            throw new ConflictException(
                    "Публикация невозможна без reviewerId, reviewedAt и статуса APPROVED", "SERVICE_NOT_REVIEWED");
        }
    }

    private void requireReason(String reason) {
        if (reason == null || reason.trim().isBlank()) {
            throw new BadRequestException("Укажите причину", "REASON_REQUIRED");
        }
    }

    private EcoServiceResponse toResponse(EcoService svc) {
        NewsAuthorDto author = svc.getAuthorId() == null ? null
                : userRepository.findById(svc.getAuthorId()).map(NewsAuthorDto::from).orElse(null);
        NewsAuthorDto reviewer = svc.getReviewerId() == null ? null
                : userRepository.findById(svc.getReviewerId()).map(NewsAuthorDto::from).orElse(null);
        return EcoServiceResponse.from(svc, author, reviewer, caseStudyService.findRelatedForService(svc.getId()), seoService.seo(svc));
    }
}
