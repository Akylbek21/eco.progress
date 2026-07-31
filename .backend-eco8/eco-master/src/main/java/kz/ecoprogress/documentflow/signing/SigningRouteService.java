package kz.ecoprogress.documentflow.signing;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.usage.UsageLimitService;
import kz.ecoprogress.documentflow.usage.UsageMetric;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentService;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.version.DocumentVersion;
import kz.ecoprogress.documentflow.version.DocumentVersionService;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class SigningRouteService {

    private final SigningRouteRepository routeRepository;
    private final SigningStepRepository stepRepository;
    private final SigningAssignmentRepository assignmentRepository;
    private final DocumentFlowAccessService accessService;
    private final UsageLimitService usageLimitService;
    private final DocumentService documentService;
    private final DocumentVersionService documentVersionService;
    private final SigningRouteProgressService progressService;
    private final DocumentFlowAuditService auditService;
    private final DocumentFlowNotificationService notificationService;

    public SigningRouteService(SigningRouteRepository routeRepository,
                                SigningStepRepository stepRepository,
                                SigningAssignmentRepository assignmentRepository,
                                DocumentFlowAccessService accessService,
                                UsageLimitService usageLimitService,
                                DocumentService documentService,
                                DocumentVersionService documentVersionService,
                                SigningRouteProgressService progressService,
                                DocumentFlowAuditService auditService,
                                DocumentFlowNotificationService notificationService) {
        this.routeRepository = routeRepository;
        this.stepRepository = stepRepository;
        this.assignmentRepository = assignmentRepository;
        this.accessService = accessService;
        this.usageLimitService = usageLimitService;
        this.documentService = documentService;
        this.documentVersionService = documentVersionService;
        this.progressService = progressService;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @Transactional
    public SigningRoute createRoute(Long documentId, SigningRouteDtos.CreateSigningRouteRequest request, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requireWriteAccess(userId, document.getOrganizationId());

        if (request.routeType() == null || request.routeType().isBlank()) {
            throw new BadRequestException("Не указан тип маршрута подписания", "ROUTE_TYPE_REQUIRED");
        }
        SigningRouteType routeType;
        try {
            routeType = SigningRouteType.valueOf(request.routeType().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Неизвестный тип маршрута подписания: " + request.routeType(), "ROUTE_TYPE_INVALID");
        }
        if (request.steps() == null || request.steps().isEmpty()) {
            throw new BadRequestException("Маршрут подписания должен содержать хотя бы один этап", "NO_SIGNERS");
        }
        int totalAssignments = request.steps().stream()
                .mapToInt(s -> s.assignments() == null ? 0 : s.assignments().size())
                .sum();
        if (totalAssignments == 0) {
            throw new BadRequestException("Маршрут подписания должен содержать хотя бы одного подписанта", "NO_SIGNERS");
        }
        boolean hasExternal = request.steps().stream()
                .flatMap(s -> s.assignments() == null ? List.<SigningRouteDtos.CreateAssignmentRequest>of().stream() : s.assignments().stream())
                .anyMatch(a -> a.signerType() != null && !"ORGANIZATION_MEMBER".equalsIgnoreCase(a.signerType()));

        if (routeRepository.existsByDocumentIdAndStatus(documentId, SigningRouteStatus.ACTIVE)) {
            throw new ConflictException("У документа уже есть активный маршрут подписания", "ROUTE_ALREADY_ACTIVE");
        }

        checkFeatureOrThrow(document.getOrganizationId(), totalAssignments > 1, FeatureCode.MULTI_SIGNING,
                "PLAN_DOES_NOT_SUPPORT_MULTI_SIGNING", "Тариф не поддерживает многостороннее подписание");
        checkFeatureOrThrow(document.getOrganizationId(), true, routeTypeFeature(routeType),
                "PLAN_DOES_NOT_SUPPORT_" + routeType + "_SIGNING",
                "Тариф не поддерживает данный тип маршрута подписания");
        checkFeatureOrThrow(document.getOrganizationId(), hasExternal, FeatureCode.EXTERNAL_SIGNING,
                "PLAN_DOES_NOT_SUPPORT_EXTERNAL_SIGNING", "Тариф не поддерживает внешних подписантов");

        SigningRoute route = new SigningRoute();
        route.setDocumentId(documentId);
        route.setRouteType(routeType);
        route.setStatus(SigningRouteStatus.DRAFT);
        route.setCreatedBy(userId);
        // saveAndFlush (not save): buildSteps() needs route.getId() immediately below to set each
        // step's FK, and this project's Hibernate can otherwise delay the IDENTITY insert (and id
        // assignment) past a plain save() call - see DocumentFlowTestFixtures for the same issue.
        routeRepository.saveAndFlush(route);

        buildSteps(route, request.steps());

        auditService.log(documentId, "SIGNING_ROUTE_CREATED", userId,
                "Маршрут " + routeType + ", подписантов: " + totalAssignments);
        return route;
    }

    private void buildSteps(SigningRoute route, List<SigningRouteDtos.CreateStepRequest> stepRequests) {
        int order = 0;
        for (SigningRouteDtos.CreateStepRequest stepReq : stepRequests) {
            List<SigningRouteDtos.CreateAssignmentRequest> assignmentReqs =
                    stepReq.assignments() == null ? List.of() : stepReq.assignments();
            SigningStep step = new SigningStep();
            step.setRouteId(route.getId());
            step.setStepOrder(order++);
            step.setRequiredCount(stepReq.requiredCount() != null ? stepReq.requiredCount() : assignmentReqs.size());
            // saveAndFlush: assignments below need step.getId() immediately for their FK.
            stepRepository.saveAndFlush(step);

            for (SigningRouteDtos.CreateAssignmentRequest req : assignmentReqs) {
                SigningAssignment assignment = new SigningAssignment();
                assignment.setStepId(step.getId());
                SignerType signerType = req.signerType() != null
                        ? SignerType.valueOf(req.signerType().toUpperCase(Locale.ROOT))
                        : SignerType.ORGANIZATION_MEMBER;
                assignment.setSignerType(signerType);
                assignment.setUserId(signerType == SignerType.ORGANIZATION_MEMBER ? req.userId() : null);
                assignment.setSignerFullName(req.signerFullName());
                assignment.setSignerIinHash(Sha256Util.hashIin(req.signerIin()));
                assignment.setOrganizationName(req.organizationName());
                assignment.setOrganizationBin(req.organizationBin());
                assignment.setEmail(req.email());
                assignment.setPhone(req.phone());
                assignment.setRoleCode(req.roleCode());
                assignment.setRequired(req.required() == null || req.required());
                assignment.setStatus(AssignmentStatus.PENDING);
                assignmentRepository.save(assignment);
            }
        }
    }

    private FeatureCode routeTypeFeature(SigningRouteType type) {
        return switch (type) {
            case SEQUENTIAL -> FeatureCode.SEQUENTIAL_SIGNING;
            case PARALLEL -> FeatureCode.PARALLEL_SIGNING;
            case MIXED -> FeatureCode.MIXED_SIGNING;
        };
    }

    private void checkFeatureOrThrow(Long organizationId, boolean applicable, FeatureCode feature,
                                      String code, String message) {
        if (!applicable) {
            return;
        }
        if (!accessService.hasFeature(organizationId, feature)) {
            throw new ForbiddenException(message, code);
        }
    }

    /** 13-point prepare-for-signing checklist - see class-level ticket description. Does not send
     *  anything to signers yet; that's send-for-signing's job. */
    @Transactional
    public SigningRoute prepareForSigning(Long documentId, SigningRouteDtos.PrepareForSigningRequest request, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        // 1. write access
        accessService.requireWriteAccess(userId, document.getOrganizationId());
        // 2. DOCUMENT_SEND permission (EDIT_DOCUMENT covers every in-flight mutation - see
        // DocumentPermissionService for why this module has no separate SEND permission)
        if (!accessService.hasPermission(userId, document.getOrganizationId(), DocumentFlowPermission.EDIT_DOCUMENT)) {
            throw new ForbiddenException("Недостаточно прав для отправки документа на подписание", "DOCUMENT_SEND_FORBIDDEN");
        }
        SigningRoute route = getDraftOrActiveRouteOrThrow(documentId);
        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        List<SigningAssignment> allAssignments = assignmentRepository.findAllByStepIdIn(steps.stream().map(SigningStep::getId).toList());
        int requiredSignatureCount = (int) allAssignments.stream().filter(SigningAssignment::isRequired).count();
        boolean hasExternal = allAssignments.stream().anyMatch(a -> a.getSignerType() != SignerType.ORGANIZATION_MEMBER);

        // 3. signing feature checks (same as creation)
        checkFeatureOrThrow(document.getOrganizationId(), allAssignments.size() > 1, FeatureCode.MULTI_SIGNING,
                "PLAN_DOES_NOT_SUPPORT_MULTI_SIGNING", "Тариф не поддерживает многостороннее подписание");
        checkFeatureOrThrow(document.getOrganizationId(), true, routeTypeFeature(route.getRouteType()),
                "PLAN_DOES_NOT_SUPPORT_" + route.getRouteType() + "_SIGNING",
                "Тариф не поддерживает данный тип маршрута подписания");

        // 4. usage limit reservation for SIGNATURES_CREATED (throws DocumentFlowLimitExceededException
        // itself if the plan's limit would be exceeded). Guarded by reservedSignatureCount == null
        // so re-preparing an already-prepared DRAFT route (idempotent per this method's contract)
        // does not reserve a second time - module spec §19, this used to also be reserved again per
        // individual signature in SigningService, double-counting every completed route.
        if (route.getReservedSignatureCount() == null) {
            usageLimitService.reserve(document.getOrganizationId(), UsageMetric.SIGNATURES_CREATED, requiredSignatureCount);
            route.setReservedSignatureCount(requiredSignatureCount);
            routeRepository.save(route);
        }

        // 5. document status allows this
        if (document.getStatus() != DocumentStatus.DRAFT && document.getStatus() != DocumentStatus.READY_FOR_SIGNING) {
            throw new ConflictException("Документ не может быть подготовлен к подписанию в текущем статусе: "
                    + document.getStatus(), "DOCUMENT_STATUS_INVALID");
        }

        // 6. resolve current version
        DocumentVersion version = documentVersionService.getCurrentVersion(documentId);

        // 7 & 8. route with assignments, at least one signer
        if (allAssignments.isEmpty() || !progressService.hasAtLeastOneSigner(route.getId())) {
            throw new ConflictException("Маршрут подписания не содержит подписантов", "NO_SIGNERS");
        }

        // 9. external re-check
        checkFeatureOrThrow(document.getOrganizationId(), hasExternal, FeatureCode.EXTERNAL_SIGNING,
                "PLAN_DOES_NOT_SUPPORT_EXTERNAL_SIGNING", "Тариф не поддерживает внешних подписантов");

        // 10. load bytes, compute sha256, compare against stored version hash
        byte[] bytes = documentVersionService.loadBytes(version.getId());
        String actualHash = Sha256Util.sha256Hex(bytes);
        if (version.getSha256Hash() != null && !version.getSha256Hash().equalsIgnoreCase(actualHash)) {
            throw new ConflictException("Хэш файла версии документа не совпадает с сохранённым - возможна порча данных в хранилище",
                    "DOCUMENT_STORAGE_CORRUPTED");
        }

        // 11. optimistic-lock check against client-supplied expected version
        if (request != null && request.expectedVersion() != null
                && !request.expectedVersion().equals(document.getVersion())) {
            throw new ConflictException("Документ был изменён другим пользователем", "OPTIMISTIC_LOCK_CONFLICT");
        }

        // 12. lock the version (idempotent)
        documentVersionService.lock(version.getId());

        // 13. audit entry
        auditService.log(documentId, "DOCUMENT_PREPARED_FOR_SIGNING", userId,
                "Версия " + version.getId() + " заблокирована, требуется подписей: " + requiredSignatureCount);

        return route;
    }

    @Transactional
    public SigningRoute sendForSigning(Long documentId, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requireWriteAccess(userId, document.getOrganizationId());
        SigningRoute route = getDraftOrActiveRouteOrThrow(documentId);
        if (route.getStatus() != SigningRouteStatus.DRAFT) {
            throw new ConflictException("Маршрут подписания уже отправлен", "ROUTE_ALREADY_ACTIVE");
        }
        DocumentVersion version = documentVersionService.getCurrentVersion(documentId);
        if (!version.isLocked()) {
            throw new ConflictException("Версия документа должна быть заблокирована перед отправкой на подписание (см. prepare-for-signing)",
                    "VERSION_NOT_LOCKED");
        }

        // Snapshot EXTERNAL_SIGNING entitlement at send time - see SigningRoute.externalSigningSnapshot
        // javadoc: an external (token-based, anonymous) signer's later sign() call must not
        // re-check the org's *current* live entitlements, only what was true when the route was
        // activated, since re-checking live entitlements for an anonymous token holder against a
        // possibly-now-different plan would be inconsistent with what the signer was invited under.
        route.setExternalSigningSnapshot(accessService.hasFeature(document.getOrganizationId(), FeatureCode.EXTERNAL_SIGNING));
        route.setStatus(SigningRouteStatus.ACTIVE);
        route.setActivatedAt(Instant.now());
        routeRepository.save(route);

        progressService.activateRoute(route);

        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        List<SigningAssignment> allAssignments = assignmentRepository.findAllByStepIdIn(steps.stream().map(SigningStep::getId).toList());
        for (SigningAssignment assignment : allAssignments) {
            if (assignment.getSignerType() != SignerType.ORGANIZATION_MEMBER) {
                // Generate an invitation token up front for every non-org-member assignment
                // (whether or not it's AVAILABLE yet on a multi-step route) - the sign()/reject()
                // endpoints separately gate on assignment.status == AVAILABLE, so an
                // not-yet-reachable token simply can't be used to sign out of turn.
                String rawToken = Sha256Util.generateToken();
                assignment.setInvitationTokenHash(Sha256Util.sha256Hex(rawToken));
                assignment.setInvitationExpiresAt(document.getSigningDeadline() != null
                        ? document.getSigningDeadline().atZone(java.time.ZoneId.systemDefault()).toInstant()
                        : Instant.now().plusSeconds(30L * 24 * 3600));
                assignmentRepository.save(assignment);
                notificationService.sendExternalInvitation(assignment, rawToken, document);
            } else if (assignment.getStatus() == AssignmentStatus.AVAILABLE) {
                notificationService.notifyOrganizationMember(assignment, document);
            }
        }

        documentService.transitionStatus(documentId, DocumentStatus.SENT_FOR_SIGNING, "Маршрут подписания активирован");
        auditService.log(documentId, "SENT_FOR_SIGNING", userId, "Маршрут " + route.getId() + " активирован");
        return route;
    }

    @Transactional
    public SigningRoute cancelSigning(Long documentId, Long userId, String reason) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requireWriteAccess(userId, document.getOrganizationId());
        SigningRoute route = getDraftOrActiveRouteOrThrow(documentId);
        if (route.getStatus() == SigningRouteStatus.COMPLETED || route.getStatus() == SigningRouteStatus.CANCELLED) {
            throw new ConflictException("Маршрут подписания уже завершён или отменён", "ROUTE_NOT_CANCELLABLE");
        }
        route.setStatus(SigningRouteStatus.CANCELLED);
        releaseReservationIfAny(document.getOrganizationId(), route);
        routeRepository.save(route);
        // Fixed bug (module spec §10): DocumentStatus's allow-list has never permitted
        // SENT_FOR_SIGNING -> DRAFT (only .../signing.CANCELLED/EXPIRED/REJECTED/...), so the old
        // code here threw InvalidStatusTransitionException at runtime on every attempt to cancel
        // an in-flight route. Cancelling an active route now correctly lands on CANCELLED, both
        // from SENT_FOR_SIGNING and PARTIALLY_SIGNED (both allow -> CANCELLED); a genuine "start
        // over from scratch" is a separate, explicit new-revision operation, not an implicit side
        // effect of cancelling a route.
        if (document.getStatus() == DocumentStatus.SENT_FOR_SIGNING
                || document.getStatus() == DocumentStatus.PARTIALLY_SIGNED) {
            documentService.transitionStatus(documentId, DocumentStatus.CANCELLED, "Подписание отменено");
        }
        auditService.log(documentId, "SIGNING_CANCELLED", userId, reason);
        return route;
    }

    /** Fixes a confirmed IDOR: previously this took no userId and performed no access check at
     *  all, so any authenticated user could view any organization's signing route (and, via
     *  DocumentFlowSigningController's signing-data endpoint and requireOwnAssignment, indirectly
     *  its steps/assignments) just by guessing a documentId. Now resolves the document's REAL
     *  organizationId and requires VIEW_DOCUMENTS on it before returning anything. */
    @Transactional(readOnly = true)
    public SigningRoute getRoute(Long documentId, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requirePermission(userId, document.getOrganizationId(), DocumentFlowPermission.VIEW_DOCUMENTS);
        return getDraftOrActiveRouteOrThrow(documentId);
    }

    @Transactional
    public SigningRoute updateRoute(Long documentId, SigningRouteDtos.CreateSigningRouteRequest request, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requireWriteAccess(userId, document.getOrganizationId());
        SigningRoute route = getDraftOrActiveRouteOrThrow(documentId);
        if (route.getStatus() != SigningRouteStatus.DRAFT) {
            throw new ConflictException("Изменять можно только маршрут в статусе DRAFT", "ROUTE_NOT_EDITABLE");
        }
        List<SigningStep> oldSteps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        List<Long> oldStepIds = oldSteps.stream().map(SigningStep::getId).toList();
        assignmentRepository.deleteAll(assignmentRepository.findAllByStepIdIn(oldStepIds));
        stepRepository.deleteAll(oldSteps);

        if (request.routeType() != null && !request.routeType().isBlank()) {
            route.setRouteType(SigningRouteType.valueOf(request.routeType().toUpperCase(Locale.ROOT)));
            routeRepository.save(route);
        }
        buildSteps(route, request.steps() != null ? request.steps() : List.of());
        auditService.log(documentId, "SIGNING_ROUTE_UPDATED", userId, null);
        return route;
    }

    private SigningRoute getDraftOrActiveRouteOrThrow(Long documentId) {
        List<SigningRoute> routes = routeRepository.findAllByDocumentId(documentId);
        return routes.stream()
                .filter(r -> r.getStatus() == SigningRouteStatus.ACTIVE || r.getStatus() == SigningRouteStatus.DRAFT)
                .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                .orElseThrow(() -> new NotFoundException("Маршрут подписания не найден", "ROUTE_NOT_FOUND"));
    }

    /** Gives back a route's reserved SIGNATURES_CREATED quota (module spec §19) when it ends
     *  without completing - idempotent via the null-out, so calling this twice on the same route
     *  (e.g. cancelSigning called again after a client retry) never double-releases. */
    void releaseReservationIfAny(Long organizationId, SigningRoute route) {
        Integer reserved = route.getReservedSignatureCount();
        if (reserved != null && reserved > 0) {
            usageLimitService.release(organizationId, UsageMetric.SIGNATURES_CREATED, reserved);
        }
        route.setReservedSignatureCount(null);
    }

    public List<SigningStep> stepsOf(Long routeId) {
        return stepRepository.findAllByRouteIdOrderByStepOrderAsc(routeId);
    }

    public List<SigningAssignment> assignmentsOf(List<Long> stepIds) {
        return new ArrayList<>(assignmentRepository.findAllByStepIdIn(stepIds));
    }
}
