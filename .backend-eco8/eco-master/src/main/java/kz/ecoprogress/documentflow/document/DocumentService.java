package kz.ecoprogress.documentflow.document;

import kz.eco.common.PageResponse;
import kz.eco.common.exception.BadRequestException;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.counterparty.Counterparty;
import kz.ecoprogress.documentflow.counterparty.CounterpartyRepository;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import kz.ecoprogress.documentflow.document.exception.DocumentNotEditableException;
import kz.ecoprogress.documentflow.document.exception.DocumentNotFoundException;
import kz.ecoprogress.documentflow.document.exception.InvalidStatusTransitionException;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowIdempotencyService;
import kz.ecoprogress.documentflow.usage.UsageLimitService;
import kz.ecoprogress.documentflow.usage.UsageMetric;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.Map;

/**
 * Owns document_flow_documents CRUD (DRAFT-only writes) plus the read paths (list/detail/
 * dashboard) and the status-transition gateway Agent C's signing routes call into. This class
 * intentionally does NOT implement send-for-signing/sign/reject business logic itself - only the
 * generic, allow-list-checked {@link #transitionStatus(Long, Long, DocumentStatus, String)} that
 * any caller (including Agent C) must go through, so DocumentStatus's transition table stays the
 * single source of truth no matter which module drives a given transition.
 */
@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final CounterpartyRepository counterpartyRepository;
    private final UserRepository userRepository;
    private final DocumentFlowAccessService accessService;
    private final UsageLimitService usageLimitService;
    private final DocumentFlowIdempotencyService idempotencyService;
    private final DocumentPermissionService permissionService;

    public DocumentService(DocumentRepository documentRepository,
                            CounterpartyRepository counterpartyRepository,
                            UserRepository userRepository,
                            DocumentFlowAccessService accessService,
                            UsageLimitService usageLimitService,
                            DocumentFlowIdempotencyService idempotencyService,
                            DocumentPermissionService permissionService) {
        this.documentRepository = documentRepository;
        this.counterpartyRepository = counterpartyRepository;
        this.userRepository = userRepository;
        this.accessService = accessService;
        this.usageLimitService = usageLimitService;
        this.idempotencyService = idempotencyService;
        this.permissionService = permissionService;
    }

    @Transactional
    public Document create(DocumentDtos.CreateDocumentRequest request, Long userId, Long organizationId,
                            String idempotencyKey) {
        Long idempotencyRecordId = null;
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            var outcome = idempotencyService.begin("document-flow-document-create", idempotencyKey, request);
            if (outcome instanceof DocumentFlowIdempotencyService.ReturnExisting existing) {
                return documentRepository.findByIdAndOrganizationId(existing.resultId(), organizationId)
                        .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
            }
            idempotencyRecordId = ((DocumentFlowIdempotencyService.Proceed) outcome).recordId();
        }

        try {
            accessService.requireWriteAccess(userId, organizationId);
            accessService.requireFeature(organizationId, FeatureCode.DOCUMENT_CREATE);
            usageLimitService.checkAndReserve(organizationId, UsageMetric.DOCUMENTS_CREATED);

            if (request.documentType() == null) {
                throw new BadRequestException("Не указан тип документа");
            }
            if (request.direction() == null) {
                throw new BadRequestException("Не указано направление документа");
            }
            if (request.title() == null || request.title().isBlank()) {
                throw new BadRequestException("Не указано название документа");
            }

            DocumentTypeConfig config = DocumentTypeRegistry.require(request.documentType());
            if (config.requiredFeature() != null) {
                accessService.requireFeature(organizationId, config.requiredFeature());
            }
            if (!config.allowsDirection(request.direction())) {
                throw new BadRequestException("Тип документа " + request.documentType()
                        + " не поддерживает направление " + request.direction());
            }
            if (config.counterpartyRequired() && request.counterpartyId() == null) {
                throw new BadRequestException("Для этого типа документа обязательно указание контрагента");
            }
            if (request.counterpartyId() != null) {
                counterpartyRepository.findByIdAndOwnerOrganizationId(request.counterpartyId(), organizationId)
                        .orElseThrow(() -> new BadRequestException("Контрагент не найден для данной организации"));
            }

            Document document = new Document();
            document.setOrganizationId(organizationId);
            document.setDocumentType(request.documentType());
            document.setDirection(request.direction());
            document.setTitle(request.title());
            document.setDescription(request.description());
            document.setCounterpartyId(request.counterpartyId());
            document.setSigningDeadline(request.signingDeadline());
            document.setAuthorUserId(userId);
            document.setStatus(DocumentStatus.DRAFT);

            switch (request.direction()) {
                case OUTGOING -> document.setSenderOrganizationId(organizationId);
                case INCOMING -> document.setRecipientOrganizationId(organizationId);
                case INTERNAL -> { /* neither sender nor recipient - purely internal */ }
            }

            document = documentRepository.save(document);
            idempotencyService.complete(idempotencyRecordId, document.getId());
            return document;
        } catch (RuntimeException e) {
            idempotencyService.fail(idempotencyRecordId);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public Document getOrThrow(Long documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
    }

    @Transactional(readOnly = true)
    public Document get(Long id, Long organizationId) {
        return documentRepository.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
    }

    @Transactional(readOnly = true)
    public PageResponse<Document> list(Long organizationId, DocumentFilter filter, Pageable pageable) {
        Page<Document> page = documentRepository.findAll(
                DocumentSpecifications.forOrganization(organizationId, filter), pageable);
        return PageResponse.of(page);
    }

    @Transactional
    public Document update(Long id, Long organizationId, Long userId, DocumentDtos.UpdateDocumentRequest request) {
        accessService.requireWriteAccess(userId, organizationId);
        Document document = get(id, organizationId);
        if (!document.getStatus().isEditable()) {
            throw new DocumentNotEditableException(
                    "Документ в статусе " + document.getStatus() + " недоступен для редактирования");
        }
        if (request.title() != null) {
            if (request.title().isBlank()) {
                throw new BadRequestException("Название документа не может быть пустым");
            }
            document.setTitle(request.title());
        }
        if (request.description() != null) {
            document.setDescription(request.description());
        }
        if (request.documentNumber() != null) {
            document.setDocumentNumber(request.documentNumber());
        }
        if (request.signingDeadline() != null) {
            document.setSigningDeadline(request.signingDeadline());
        }
        if (request.counterpartyId() != null) {
            counterpartyRepository.findByIdAndOwnerOrganizationId(request.counterpartyId(), organizationId)
                    .orElseThrow(() -> new BadRequestException("Контрагент не найден для данной организации"));
            document.setCounterpartyId(request.counterpartyId());
        }
        document.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(document);
    }

    @Transactional
    public void delete(Long id, Long organizationId, Long userId) {
        accessService.requireWriteAccess(userId, organizationId);
        Document document = get(id, organizationId);
        if (document.getStatus() != DocumentStatus.DRAFT) {
            throw new DocumentNotEditableException("Удалить можно только документ в статусе DRAFT");
        }
        documentRepository.delete(document);
    }

    /**
     * The single gateway for advancing a document's status, enforcing {@link DocumentStatus}'s
     * allow-list. Agent C's signing routes call this directly - e.g.
     * {@code documentService.transitionStatus(documentId, organizationId, DocumentStatus.SENT_FOR_SIGNING, note)}
     * when sending for signing (after locking the current version via
     * {@code DocumentVersionService.lock(currentVersionId)}), and
     * {@code documentService.transitionStatus(documentId, organizationId, DocumentStatus.SIGNED, note)}
     * once the last required signature lands. {@code actorNote} is accepted for future audit-log
     * wiring but not yet persisted anywhere (no audit table in this module's scope).
     */
    /** Convenience overload for callers (Agent C's signing/revocation flows) that only have the
     *  documentId at hand - resolves organizationId from the document itself. */
    @Transactional
    public Document transitionStatus(Long documentId, DocumentStatus target, String actorNote) {
        Document document = getOrThrow(documentId);
        return transitionStatus(documentId, document.getOrganizationId(), target, actorNote);
    }

    @Transactional
    public Document transitionStatus(Long documentId, Long organizationId, DocumentStatus target, String actorNote) {
        Document document = get(documentId, organizationId);
        DocumentStatus current = document.getStatus();
        if (!current.canTransitionTo(target)) {
            throw new InvalidStatusTransitionException(
                    "Недопустимый переход статуса документа: " + current + " -> " + target);
        }
        document.setStatus(target);
        LocalDateTime now = LocalDateTime.now();
        switch (target) {
            case SENT_FOR_SIGNING -> document.setSentAt(now);
            case SIGNED -> document.setCompletedAt(now);
            case ARCHIVED -> document.setArchivedAt(now);
            default -> { /* no timestamp side effect for this target */ }
        }
        document.setUpdatedAt(now);
        return documentRepository.save(document);
    }

    @Transactional(readOnly = true)
    public DocumentDtos.DashboardResponse dashboard(Long organizationId) {
        Map<DocumentStatus, Long> byStatus = new EnumMap<>(DocumentStatus.class);
        for (DocumentStatus status : DocumentStatus.values()) {
            long count = documentRepository.countByOrganizationIdAndStatus(organizationId, status);
            if (count > 0) {
                byStatus.put(status, count);
            }
        }
        Map<DocumentDirection, Long> byDirection = new EnumMap<>(DocumentDirection.class);
        for (DocumentDirection direction : DocumentDirection.values()) {
            long count = documentRepository.countByOrganizationIdAndDirection(organizationId, direction);
            if (count > 0) {
                byDirection.put(direction, count);
            }
        }
        long total = documentRepository.countByOrganizationId(organizationId);
        return new DocumentDtos.DashboardResponse(total, byStatus, byDirection);
    }

    @Transactional(readOnly = true)
    public DocumentDtos.DocumentListItemDto toListItemDto(Document document, Long userId, Long organizationId) {
        DocumentDtos.DocumentPermissions permissions = permissionService.calculate(document, userId, organizationId);
        return new DocumentDtos.DocumentListItemDto(
                document.getId(),
                document.getDocumentNumber(),
                document.getTitle(),
                document.getDocumentType(),
                document.getDirection(),
                counterpartySummary(document.getCounterpartyId()),
                userSummary(document.getAuthorUserId()),
                document.getCreatedAt(),
                document.getSigningDeadline(),
                document.getStatus(),
                0, // TODO-RECONCILE: signedCount once Agent C's signature tables exist
                0, // TODO-RECONCILE: requiredCount once Agent C's signing-assignment tables exist
                false, // TODO-RECONCILE: requiresMySignature once Agent C's tables exist
                document.getVersion(),
                permissions,
                permissionService.availableActions(permissions)
        );
    }

    @Transactional(readOnly = true)
    public DocumentDtos.DocumentDetailDto toDetailDto(Document document, Long userId, Long organizationId) {
        DocumentDtos.DocumentPermissions permissions = permissionService.calculate(document, userId, organizationId);
        return new DocumentDtos.DocumentDetailDto(
                document.getId(),
                document.getPublicId(),
                document.getDocumentNumber(),
                document.getTitle(),
                document.getDescription(),
                document.getDocumentType(),
                document.getDirection(),
                counterpartySummary(document.getCounterpartyId()),
                userSummary(document.getAuthorUserId()),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                document.getSigningDeadline(),
                document.getStatus(),
                document.getCurrentVersionId(),
                document.getVersion(),
                permissions,
                permissionService.availableActions(permissions)
        );
    }

    private DocumentDtos.CounterpartySummary counterpartySummary(Long counterpartyId) {
        if (counterpartyId == null) {
            return null;
        }
        return counterpartyRepository.findById(counterpartyId)
                .map(c -> new DocumentDtos.CounterpartySummary(c.getId(), c.getName(), c.getBin()))
                .orElse(null);
    }

    private DocumentDtos.UserSummary userSummary(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(this::toUserSummary)
                .orElse(null);
    }

    private DocumentDtos.UserSummary toUserSummary(User user) {
        return new DocumentDtos.UserSummary(user.getId(), user.getName());
    }
}
