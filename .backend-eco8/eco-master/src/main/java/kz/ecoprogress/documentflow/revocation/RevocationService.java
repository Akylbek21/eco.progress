package kz.ecoprogress.documentflow.revocation;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentService;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.signing.DocumentFlowAuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class RevocationService {

    private final RevocationRequestRepository repository;
    private final DocumentService documentService;
    private final DocumentFlowAccessService accessService;
    private final DocumentFlowAuditService auditService;

    public RevocationService(RevocationRequestRepository repository, DocumentService documentService,
                              DocumentFlowAccessService accessService, DocumentFlowAuditService auditService) {
        this.repository = repository;
        this.documentService = documentService;
        this.accessService = accessService;
        this.auditService = auditService;
    }

    @Transactional
    public RevocationRequest create(Long documentId, String reason, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requireWriteAccess(userId, document.getOrganizationId());
        RevocationRequest request = new RevocationRequest();
        request.setDocumentId(documentId);
        request.setRequestedBy(userId);
        request.setReason(reason);
        request.setStatus(RevocationStatus.DRAFT);
        // saveAndFlush: callers (controller/tests) use request.getId() right after create()
        // returns - see DocumentFlowTestFixtures for why a plain save() can leave a
        // freshly-IDENTITY-generated id unpopulated until the next flush on this Hibernate version.
        repository.saveAndFlush(request);
        auditService.log(documentId, "REVOCATION_REQUEST_CREATED", userId, reason);
        return request;
    }

    @Transactional
    public RevocationRequest send(Long requestId, Long userId) {
        RevocationRequest request = getOrThrow(requestId);
        requireRevokeAccess(request, userId);
        requireStatus(request, RevocationStatus.DRAFT);
        // SENT and PENDING are collapsed into one transition here: this module has no separate
        // "delivery acknowledged" step distinct from "awaiting a decision", so sending a request
        // immediately puts it in PENDING (approve/reject act on PENDING or SENT either way).
        request.setStatus(RevocationStatus.PENDING);
        touch(request);
        repository.save(request);
        // DocumentStatus's allow-list (kz.ecoprogress.documentflow.document.DocumentStatus) only
        // permits SIGNED -> REVOCATION_REQUESTED -> REVOKED, never SIGNED -> REVOKED directly - so
        // the document must move to REVOCATION_REQUESTED here, before approve() can transition it
        // the rest of the way to REVOKED.
        documentService.transitionStatus(request.getDocumentId(), DocumentStatus.REVOCATION_REQUESTED,
                "Запрос на отзыв документа отправлен на согласование");
        auditService.log(request.getDocumentId(), "REVOCATION_REQUEST_SENT", userId, null);
        return request;
    }

    @Transactional
    public RevocationRequest approve(Long requestId, String comment, Long userId) {
        RevocationRequest request = getOrThrow(requestId);
        requireRevokeAccess(request, userId);
        requireStatus(request, RevocationStatus.PENDING, RevocationStatus.SENT);
        request.setStatus(RevocationStatus.APPROVED);
        request.setResolvedAt(Instant.now());
        request.setResolvedBy(userId);
        request.setResolutionComment(comment);
        touch(request);
        repository.save(request);
        // The original document is never deleted - only status-transitioned to REVOKED, so its
        // full history (versions, signatures, audit log) remains readable afterward.
        documentService.transitionStatus(request.getDocumentId(), DocumentStatus.REVOKED,
                "Отзыв утверждён: " + comment);
        auditService.log(request.getDocumentId(), "REVOCATION_APPROVED", userId, comment);
        return request;
    }

    @Transactional
    public RevocationRequest reject(Long requestId, String comment, Long userId) {
        RevocationRequest request = getOrThrow(requestId);
        requireRevokeAccess(request, userId);
        requireStatus(request, RevocationStatus.PENDING, RevocationStatus.SENT);
        request.setStatus(RevocationStatus.REJECTED);
        request.setResolvedAt(Instant.now());
        request.setResolvedBy(userId);
        request.setResolutionComment(comment);
        touch(request);
        repository.save(request);
        auditService.log(request.getDocumentId(), "REVOCATION_REJECTED", userId, comment);
        return request;
    }

    @Transactional
    public RevocationRequest cancel(Long requestId, Long userId) {
        RevocationRequest request = getOrThrow(requestId);
        requireRevokeAccess(request, userId);
        if (request.getStatus() == RevocationStatus.APPROVED || request.getStatus() == RevocationStatus.REJECTED) {
            throw new ConflictException("Запрос на отзыв уже завершён", "REVOCATION_ALREADY_RESOLVED");
        }
        request.setStatus(RevocationStatus.CANCELLED);
        touch(request);
        repository.save(request);
        auditService.log(request.getDocumentId(), "REVOCATION_CANCELLED", userId, null);
        return request;
    }

    @Transactional(readOnly = true)
    public List<RevocationRequest> history(Long documentId, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requirePermission(userId, document.getOrganizationId(), DocumentFlowPermission.VIEW_DOCUMENTS);
        return repository.findAllByDocumentIdOrderByCreatedAtDesc(documentId);
    }

    /** IDOR fix: send/approve/reject/cancel previously only did getOrThrow(requestId) with no
     *  access check whatsoever - only create() checked access. Any authenticated user who knew or
     *  guessed a requestId could approve/reject/cancel another organization's revocation request.
     *  Resolves the real owning document's organizationId (never trusts anything client-supplied)
     *  and requires REVOKE_SIGNATURE on it. */
    private void requireRevokeAccess(RevocationRequest request, Long userId) {
        Document document = documentService.getOrThrow(request.getDocumentId());
        accessService.requirePermission(userId, document.getOrganizationId(), DocumentFlowPermission.REVOKE_SIGNATURE);
    }

    private void requireStatus(RevocationRequest request, RevocationStatus... allowed) {
        for (RevocationStatus s : allowed) {
            if (request.getStatus() == s) return;
        }
        throw new ConflictException("Недопустимый переход статуса запроса на отзыв из " + request.getStatus(),
                "REVOCATION_INVALID_TRANSITION");
    }

    private void touch(RevocationRequest request) {
        request.setUpdatedAt(Instant.now());
    }

    private RevocationRequest getOrThrow(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Запрос на отзыв не найден", "REVOCATION_NOT_FOUND"));
    }
}
