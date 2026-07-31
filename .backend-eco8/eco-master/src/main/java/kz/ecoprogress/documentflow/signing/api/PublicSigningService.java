package kz.ecoprogress.documentflow.signing.api;

import kz.eco.common.exception.NotFoundException;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentService;
import kz.ecoprogress.documentflow.version.DocumentVersion;
import kz.ecoprogress.documentflow.version.DocumentVersionService;
import kz.ecoprogress.documentflow.signing.AssignmentStatus;
import kz.ecoprogress.documentflow.signing.DocumentFlowAuditService;
import kz.ecoprogress.documentflow.signing.DocumentFlowSignature;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
import kz.ecoprogress.documentflow.signing.Sha256Util;
import kz.ecoprogress.documentflow.signing.SigningAssignment;
import kz.ecoprogress.documentflow.signing.SigningAssignmentRepository;
import kz.ecoprogress.documentflow.signing.SigningRoute;
import kz.ecoprogress.documentflow.signing.SigningRouteRepository;
import kz.ecoprogress.documentflow.signing.SigningService;
import kz.ecoprogress.documentflow.signing.SigningStep;
import kz.ecoprogress.documentflow.signing.SigningStepRepository;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * External-signer, token-based public API (no JWT). Every entry point re-derives the assignment
 * from the invitation token hash and re-checks expiry - a caller can never get further than that
 * without a valid, unexpired token, and this class never leaks anything about the document beyond
 * the minimal safe view.
 */
@Service
public class PublicSigningService {

    private final SigningAssignmentRepository assignmentRepository;
    private final SigningStepRepository stepRepository;
    private final SigningRouteRepository routeRepository;
    private final DocumentService documentService;
    private final DocumentVersionService documentVersionService;
    private final SigningService signingService;
    private final DocumentFlowAuditService auditService;

    public PublicSigningService(SigningAssignmentRepository assignmentRepository,
                                 SigningStepRepository stepRepository,
                                 SigningRouteRepository routeRepository,
                                 DocumentService documentService,
                                 DocumentVersionService documentVersionService,
                                 SigningService signingService,
                                 DocumentFlowAuditService auditService) {
        this.assignmentRepository = assignmentRepository;
        this.stepRepository = stepRepository;
        this.routeRepository = routeRepository;
        this.documentService = documentService;
        this.documentVersionService = documentVersionService;
        this.signingService = signingService;
        this.auditService = auditService;
    }

    public record PublicInvitationView(
            Long documentId,
            String documentTitle,
            String roleCode,
            boolean required,
            String status,
            String invitationExpiresAt,
            String signingDeadline
    ) {
    }

    @Transactional(readOnly = true)
    public SigningAssignment resolveAssignment(String rawToken) {
        String tokenHash = Sha256Util.sha256Hex(rawToken);
        SigningAssignment assignment = assignmentRepository.findByInvitationTokenHash(tokenHash)
                .orElseThrow(() -> new NotFoundException("Приглашение не найдено или недействительно", "INVITATION_INVALID"));
        if (assignment.getInvitationExpiresAt() != null && Instant.now().isAfter(assignment.getInvitationExpiresAt())) {
            throw new ForbiddenException("Срок действия приглашения истёк", "INVITATION_EXPIRED");
        }
        return assignment;
    }

    @Transactional(readOnly = true)
    public PublicInvitationView getInvitationView(String rawToken) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        Document document = documentService.getOrThrow(route.getDocumentId());
        return new PublicInvitationView(
                document.getId(),
                document.getTitle(),
                assignment.getRoleCode(),
                assignment.isRequired(),
                assignment.getStatus().name(),
                String.valueOf(assignment.getInvitationExpiresAt()),
                String.valueOf(document.getSigningDeadline()));
    }

    @Transactional(readOnly = true)
    public byte[] getDocumentBytes(String rawToken) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        DocumentVersion version = documentVersionService.getCurrentVersion(route.getDocumentId());
        return documentVersionService.loadBytes(version.getId());
    }

    @Transactional
    public void markViewed(String rawToken) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        if (assignment.getViewedAt() == null) {
            assignment.setViewedAt(Instant.now());
            if (assignment.getStatus() == AssignmentStatus.AVAILABLE) {
                assignment.setStatus(AssignmentStatus.VIEWED);
            }
            assignmentRepository.save(assignment);
        }
    }

    @Transactional
    public DocumentFlowSignature sign(String rawToken, SigningRouteDtos.SubmitSignatureRequest request) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        // Snapshot check (see SigningRoute.externalSigningSnapshot javadoc): whether
        // EXTERNAL_SIGNING was entitled at send-for-signing time, NOT the org's current live
        // entitlement - an anonymous token holder must get a consistent answer regardless of
        // what the sending org's plan does afterward.
        if (!route.isExternalSigningSnapshot()) {
            throw new ForbiddenException("Внешнее подписание было отключено для этого маршрута", "PLAN_DOES_NOT_SUPPORT_EXTERNAL_SIGNING");
        }
        return signingService.recordSignature(request, assignment, null);
    }

    @Transactional
    public void reject(String rawToken, String reason) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        boolean anyPriorSignatures = !signingService.listSignaturesInternal(route.getDocumentId()).isEmpty();
        signingService.reject(route.getDocumentId(), assignment, reason, anyPriorSignatures);
    }

    private SigningRoute routeOf(SigningAssignment assignment) {
        SigningStep step = stepRepository.findById(assignment.getStepId())
                .orElseThrow(() -> new NotFoundException("Этап маршрута не найден"));
        return routeRepository.findById(step.getRouteId())
                .orElseThrow(() -> new NotFoundException("Маршрут подписания не найден", "ROUTE_NOT_FOUND"));
    }
}
