package kz.ecoprogress.documentflow.signing;

import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.storage.FileStorageService;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Signature submission + read/verification endpoints. The 15-point checklist for signature
 * submission (see class javadoc on each check below) mirrors kz.eco.protocol.ProtocolService.sign
 * as closely as this module's route/assignment model allows.
 */
@Service
public class SigningService {

    private final SigningRouteRepository routeRepository;
    private final SigningStepRepository stepRepository;
    private final SigningAssignmentRepository assignmentRepository;
    private final DocumentFlowSignatureRepository signatureRepository;
    private final DocumentService documentService;
    private final DocumentVersionService documentVersionService;
    private final CmsDocumentVerificationService verificationService;
    private final FileStorageService fileStorageService;
    private final SigningRouteProgressService progressService;
    private final DocumentFlowAuditService auditService;
    private final DocumentFlowAccessService accessService;
    private final UsageLimitService usageLimitService;
    private final DocumentFlowNotificationService notificationService;
    private final ObjectMapper objectMapper;

    public SigningService(SigningRouteRepository routeRepository,
                           SigningStepRepository stepRepository,
                           SigningAssignmentRepository assignmentRepository,
                           DocumentFlowSignatureRepository signatureRepository,
                           DocumentService documentService,
                           DocumentVersionService documentVersionService,
                           CmsDocumentVerificationService verificationService,
                           FileStorageService fileStorageService,
                           SigningRouteProgressService progressService,
                           DocumentFlowAuditService auditService,
                           DocumentFlowAccessService accessService,
                           UsageLimitService usageLimitService,
                           DocumentFlowNotificationService notificationService,
                           ObjectMapper objectMapper) {
        this.routeRepository = routeRepository;
        this.stepRepository = stepRepository;
        this.assignmentRepository = assignmentRepository;
        this.signatureRepository = signatureRepository;
        this.documentService = documentService;
        this.documentVersionService = documentVersionService;
        this.verificationService = verificationService;
        this.fileStorageService = fileStorageService;
        this.progressService = progressService;
        this.auditService = auditService;
        this.accessService = accessService;
        this.usageLimitService = usageLimitService;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    /**
     * Authenticated org-member signer path. {@code actingUserId} must equal the assignment's own
     * userId (check #3 below) - so unlike the public token-based path, the caller's identity comes
     * from the JWT session, not a token lookup.
     */
    @Transactional
    public DocumentFlowSignature submitOrganizationMemberSignature(SigningRouteDtos.SubmitSignatureRequest request, Long actingUserId) {
        SigningAssignment assignment = assignmentRepository.findById(request.assignmentId())
                .orElseThrow(() -> new NotFoundException("Назначение подписанта не найдено", "ASSIGNMENT_NOT_FOUND"));
        if (assignment.getSignerType() != SignerType.ORGANIZATION_MEMBER
                || assignment.getUserId() == null || !assignment.getUserId().equals(actingUserId)) {
            throw new ForbiddenException("Вы не назначены подписантом по этому заданию", "NOT_ASSIGNEE");
        }
        return recordSignature(request, assignment, actingUserId);
    }

    /** Shared checklist, called by both the authenticated endpoint (above) and the public
     *  token-resolved external-signer endpoint (kz.ecoprogress.documentflow.signing.api.PublicSigningService) -
     *  public (not package-private) precisely because that caller lives in a subpackage. */
    @Transactional
    public DocumentFlowSignature recordSignature(SigningRouteDtos.SubmitSignatureRequest request, SigningAssignment assignment, Long signerUserId) {
        rejectPrivateKeyMaterial(request);
        SigningStep step = stepRepository.findById(assignment.getStepId())
                .orElseThrow(() -> new NotFoundException("Этап маршрута не найден"));
        SigningRoute route = routeRepository.findById(step.getRouteId())
                .orElseThrow(() -> new NotFoundException("Маршрут подписания не найден", "ROUTE_NOT_FOUND"));
        if (!route.getDocumentId().equals(request.documentId())) {
            throw new NotFoundException("Назначение не принадлежит указанному документу", "ASSIGNMENT_NOT_FOUND");
        }
        Document document = documentService.getOrThrow(route.getDocumentId());

        // Check #2: assignment must be AVAILABLE (not already signed/rejected/expired).
        if (assignment.getStatus() == AssignmentStatus.SIGNED) {
            throw new ConflictException("Задание уже подписано", "SIGNATURE_ALREADY_EXISTS");
        }
        if (assignment.getStatus() != AssignmentStatus.AVAILABLE && assignment.getStatus() != AssignmentStatus.VIEWED) {
            throw new ConflictException("Задание недоступно для подписания в текущем статусе: " + assignment.getStatus(),
                    "ASSIGNMENT_NOT_AVAILABLE");
        }

        // Deliberate policy exception (see ticket): an already-sent document's signing route may
        // complete even if the sending org's subscription/write-access lapses mid-route - only
        // NEW route/document creation is blocked by requireWriteAccess(). We therefore do NOT call
        // accessService.requireWriteAccess() here at all for signing itself.
        if (route.getStatus() != SigningRouteStatus.ACTIVE) {
            throw new ConflictException("Маршрут подписания не активен", "ROUTE_NOT_ACTIVE");
        }

        DocumentVersion version = documentVersionService.getCurrentVersion(document.getId());
        if (!version.getId().equals(request.versionId())) {
            throw new ConflictException("Указана неактуальная версия документа", "VERSION_MISMATCH");
        }
        if (!version.isLocked()) {
            // Should be impossible by construction (prepare-for-signing always locks before a
            // route can be sent) - treated as a data-integrity error, not a normal business rule.
            throw new ConflictException("Версия документа не заблокирована - нарушение целостности данных", "VERSION_NOT_LOCKED");
        }

        // Deadline check.
        if (document.getSigningDeadline() != null
                && Instant.now().isAfter(document.getSigningDeadline().atZone(java.time.ZoneId.systemDefault()).toInstant())) {
            throw new ConflictException("Срок подписания документа истёк", "ASSIGNMENT_NOT_AVAILABLE");
        }

        byte[] documentBytes = documentVersionService.loadBytes(version.getId());
        CmsDocumentVerificationService.Result result;
        try {
            result = verificationService.verify(request.cms(), documentBytes, version.getSha256Hash());
        } catch (UnprocessableEntityException e) {
            throw e;
        }

        // IIN check, if the assignment recorded an expected signer IIN hash.
        if (assignment.getSignerIinHash() != null) {
            String signerIinHash = Sha256Util.hashIin(result.signatureInfo().serialNumber());
            if (signerIinHash == null || !signerIinHash.equals(assignment.getSignerIinHash())) {
                throw new UnprocessableEntityException("ИИН подписанта не совпадает с ожидаемым", "SIGNER_IIN_MISMATCH");
            }
        }

        // Usage quota fix (module spec §19 - "устрани двойное списание"): the route's FULL
        // requiredSignatureCount is already reserved once, up front, in
        // SigningRouteService.prepareForSigning (and released back if the route is cancelled
        // before completing - see cancelSigning/reject). Reserving another 1 unit per individual
        // signature here on top of that double-counted every completed route (~2x its real
        // signature count against the plan limit). This module now uses the reservation model
        // exclusively: nothing is incremented again at signature time.

        String requestId = request.clientRequestId() != null && !request.clientRequestId().isBlank()
                ? request.clientRequestId()
                : "auto-" + assignment.getId() + "-" + Instant.now().toEpochMilli();

        var stored = storeCms(request.cms(), document.getId(), assignment.getId());

        DocumentFlowSignature signature = new DocumentFlowSignature();
        signature.setDocumentId(document.getId());
        signature.setDocumentVersionId(version.getId());
        signature.setRouteId(route.getId());
        signature.setAssignmentId(assignment.getId());
        signature.setSignerUserId(signerUserId);
        signature.setCmsStorageKey(stored);
        signature.setCmsHash(Sha256Util.sha256Hex(request.cms()));
        signature.setCertificateSerialNumber(result.signatureInfo().serialNumber());
        signature.setCertificateSubject(result.signatureInfo().subjectDN());
        // SignatureInfo doesn't expose the certificate issuer separately (self-signed test certs
        // and the existing ProtocolService pattern never needed it) - left null rather than
        // guessing; TODO-RECONCILE if a future SignatureVerificationService revision adds it.
        signature.setCertificateIssuer(null);
        signature.setCertificateIinHash(Sha256Util.hashIin(result.signatureInfo().serialNumber()));
        signature.setCertificateBin(assignment.getOrganizationBin());
        signature.setCertificateValidFrom(result.certificateInfo().notBefore());
        signature.setCertificateValidTo(result.certificateInfo().notAfter());
        signature.setSignedAt(Instant.now());
        signature.setTrustedTimestamp(null); // known limitation - no TSA integration, see entity javadoc
        signature.setVerificationStatus(result.status());
        signature.setVerificationDetailsJson(writeDetailsJson(result));
        signature.setRequestId(requestId);

        try {
            signatureRepository.saveAndFlush(signature);
        } catch (DataIntegrityViolationException dive) {
            // Unique (assignment_id) / (request_id) constraints are the last line of defense
            // against a genuine double-click race - never let it surface as a raw 500.
            throw new ConflictException("Подпись для этого задания уже существует", "SIGNATURE_ALREADY_EXISTS");
        }

        assignment.setStatus(AssignmentStatus.SIGNED);
        assignment.setSignedAt(Instant.now());
        assignmentRepository.save(assignment);

        progressService.onAssignmentSigned(assignment);

        auditService.log(document.getId(), "SIGNED", signerUserId,
                "Задание " + assignment.getId() + ", сертификат ИИН-hash=" + truncate(signature.getCertificateIinHash()));

        return signature;
    }

    private static void rejectPrivateKeyMaterial(SigningRouteDtos.SubmitSignatureRequest request) {
        if (request.privateKey() != null || request.password() != null || request.pkcs12() != null) {
            throw new kz.eco.common.exception.BadRequestException(
                    "Передача закрытого ключа/пароля/PKCS12 запрещена - подпись должна создаваться на стороне клиента (NCALayer)",
                    "PRIVATE_KEY_MATERIAL_NOT_ALLOWED");
        }
    }

    private String storeCms(String cmsBase64, Long documentId, Long assignmentId) {
        try {
            return fileStorageService.storeBytes(
                    cmsBase64.getBytes(StandardCharsets.UTF_8),
                    "document-" + documentId + "-assignment-" + assignmentId + ".cms",
                    "application/pkcs7-mime",
                    "document-flow-" + documentId, String.valueOf(assignmentId)).fileId();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить файл подписи", e);
        }
    }

    private String writeDetailsJson(CmsDocumentVerificationService.Result result) {
        try {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("commonName", result.signatureInfo().commonName());
            details.put("organization", result.signatureInfo().organization());
            details.put("verified", result.signatureInfo().verified());
            details.put("certificateNotBefore", String.valueOf(result.certificateInfo().notBefore()));
            details.put("certificateNotAfter", String.valueOf(result.certificateInfo().notAfter()));
            details.put("status", result.status().name());
            return objectMapper.writeValueAsString(details);
        } catch (Exception e) {
            return null;
        }
    }

    private void requireViewAccess(Long documentId, Long userId) {
        Document document = documentService.getOrThrow(documentId);
        accessService.requirePermission(userId, document.getOrganizationId(), DocumentFlowPermission.VIEW_DOCUMENTS);
    }

    private static String truncate(String value) {
        if (value == null) return null;
        return value.length() <= 12 ? value : value.substring(0, 12) + "...";
    }

    /** IDOR fix: this took no userId and performed no access check at all - any authenticated
     *  user could list any organization's signatures just by guessing a documentId. */
    @Transactional(readOnly = true)
    public List<DocumentFlowSignature> listSignatures(Long documentId, Long userId) {
        requireViewAccess(documentId, userId);
        return signatureRepository.findAllByDocumentId(documentId);
    }

    /** Same query, deliberately without the organization-membership access check - for callers
     *  that already established authorization through a different mechanism. The ONLY legitimate
     *  caller is kz.ecoprogress.documentflow.signing.api.PublicSigningService, whose raw signing
     *  token has already been resolved and validated (see PublicSigningService#resolveAssignment)
     *  before this is ever reached - an external signer has no org membership to check against.
     *  Do not call this from any authenticated, org-scoped endpoint; use
     *  {@link #listSignatures(Long, Long)} there instead. */
    @Transactional(readOnly = true)
    public List<DocumentFlowSignature> listSignaturesInternal(Long documentId) {
        return signatureRepository.findAllByDocumentId(documentId);
    }

    /** Re-runs verification against each stored CMS + the current version bytes, returning
     *  per-signature results without mutating anything. IDOR fix: same missing access check as
     *  listSignatures - this backs both /signatures/verify-all and /verification-report. */
    @Transactional(readOnly = true)
    public Map<Long, VerificationStatus> verifyAll(Long documentId, Long userId) {
        requireViewAccess(documentId, userId);
        DocumentVersion version = documentVersionService.getCurrentVersion(documentId);
        byte[] documentBytes = documentVersionService.loadBytes(version.getId());
        Map<Long, VerificationStatus> results = new LinkedHashMap<>();
        for (DocumentFlowSignature signature : signatureRepository.findAllByDocumentId(documentId)) {
            try {
                String cms;
                try {
                    cms = new String(fileStorageService.load(signature.getCmsStorageKey()).inputStream().readAllBytes(), StandardCharsets.UTF_8);
                } catch (IOException e) {
                    throw new IllegalStateException(e);
                }
                CmsDocumentVerificationService.Result result = verificationService.verify(cms, documentBytes, null);
                results.put(signature.getId(), result.status());
            } catch (UnprocessableEntityException e) {
                results.put(signature.getId(), VerificationStatus.INVALID);
            }
        }
        return results;
    }

    /** Streams the final document bytes + every stored CMS blob as a single zip, without loading
     *  everything into memory at once (each entry is copied straight from its own InputStream).
     *  IDOR fix: this took no userId and performed no access check at all - any authenticated user
     *  could download any organization's signed package just by guessing a documentId. */
    @Transactional(readOnly = true)
    public void writeSignedPackage(Long documentId, Long userId, OutputStream out) throws IOException {
        requireViewAccess(documentId, userId);
        DocumentVersion version = documentVersionService.getCurrentVersion(documentId);
        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            zos.putNextEntry(new ZipEntry("document.bin"));
            zos.write(documentVersionService.loadBytes(version.getId()));
            zos.closeEntry();
            for (DocumentFlowSignature signature : signatureRepository.findAllByDocumentId(documentId)) {
                zos.putNextEntry(new ZipEntry("signatures/signature-" + signature.getId() + ".cms"));
                try (var in = fileStorageService.load(signature.getCmsStorageKey()).inputStream()) {
                    in.transferTo(zos);
                }
                zos.closeEntry();
            }
        }
    }

    @Transactional
    public void reject(Long documentId, SigningAssignment assignment, String reason, boolean anyPriorSignatures) {
        assignment.setStatus(AssignmentStatus.REJECTED);
        assignment.setRejectedAt(Instant.now());
        assignment.setRejectionReason(reason);
        assignmentRepository.save(assignment);
        // Rule (ticket's "your call"): if nobody has signed yet, a rejection sends the whole
        // document back for revision (the sender can fix it and restart the route); if at least
        // one other signer already signed, treat it as a hard REJECTED instead, since a partially
        // signed document can't just be silently "revised" without invalidating those signatures.
        DocumentStatus target = anyPriorSignatures ? DocumentStatus.REJECTED : DocumentStatus.RETURNED_FOR_REVISION;
        Document document = documentService.transitionStatus(documentId, target, "Отклонено подписантом: " + reason);
        auditService.log(documentId, "SIGNING_REJECTED", assignment.getUserId(), reason);
        notificationService.notifyAuthorOfRejection(document, reason);
    }

    public SigningAssignmentRepository assignmentRepository() {
        return assignmentRepository;
    }

    public DocumentFlowSignatureRepository signatureRepository() {
        return signatureRepository;
    }
}
