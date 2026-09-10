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

    /** Module spec §13: real filename/MIME/size/hash for the version this token's assignment is
     *  actually pinned to - version/assignment ids never leave the server, only what's needed to
     *  fetch and verify the bytes (GET .../file) and build the CMS payload. */
    @Transactional(readOnly = true)
    public kz.ecoprogress.documentflow.signing.dto.PublicSigningChallengeDto getChallenge(String rawToken) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        Document document = documentService.getOrThrow(route.getDocumentId());
        DocumentVersion version = documentVersionService.getCurrentVersion(route.getDocumentId());
        return new kz.ecoprogress.documentflow.signing.dto.PublicSigningChallengeDto(
                document.getTitle(),
                document.getDocumentNumber(),
                assignment.getRoleCode(),
                version.getOriginalFileName(),
                version.getMimeType(),
                version.getFileSize(),
                version.getSha256Hash(),
                version.getSha256Hash(),
                "SHA-256",
                String.valueOf(assignment.getInvitationExpiresAt()),
                String.valueOf(document.getSigningDeadline()));
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

    @Deprecated
    @Transactional
    public DocumentFlowSignature sign(String rawToken, SigningRouteDtos.SubmitSignatureRequest request) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        requireExternalSigningEnabled(route);
        return signingService.recordSignature(request, assignment, null);
    }

    /** Module spec §13: token-only variant - documentId/versionId/assignmentId are never taken
     *  from the client, only {cms, clientRequestId}. Builds the same internal SubmitSignatureRequest
     *  SigningService.recordSignature already expects, but populated entirely from the
     *  token-resolved assignment/route/current-version - there is no client-suppliable field left
     *  that could point at a different document. */
    @Transactional
    public DocumentFlowSignature signByToken(String rawToken, String cms, String clientRequestId) {
        SigningAssignment assignment = resolveAssignment(rawToken);
        SigningRoute route = routeOf(assignment);
        requireExternalSigningEnabled(route);
        DocumentVersion version = documentVersionService.getCurrentVersion(route.getDocumentId());
        SigningRouteDtos.SubmitSignatureRequest request = new SigningRouteDtos.SubmitSignatureRequest(
                route.getDocumentId(), version.getId(), assignment.getId(), cms, clientRequestId, null, null, null);
        return signingService.recordSignature(request, assignment, null);
    }

    /** Snapshot check (see SigningRoute.externalSigningSnapshot javadoc): whether EXTERNAL_SIGNING
     *  was entitled at send-for-signing time, NOT the org's current live entitlement - an
     *  anonymous token holder must get a consistent answer regardless of what the sending org's
     *  plan does afterward. */
    private void requireExternalSigningEnabled(SigningRoute route) {
        if (!route.isExternalSigningSnapshot()) {
            throw new ForbiddenException("Внешнее подписание было отключено для этого маршрута", "PLAN_DOES_NOT_SUPPORT_EXTERNAL_SIGNING");
        }
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
