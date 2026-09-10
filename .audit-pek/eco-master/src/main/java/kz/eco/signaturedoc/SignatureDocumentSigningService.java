package kz.eco.signaturedoc;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import org.springframework.security.access.AccessDeniedException;
import kz.eco.signature.EdsSigningPolicyService;
import kz.eco.signature.SignatureInfo;
import kz.eco.signature.SignatureVerificationService;
import kz.eco.signature.verification.CertificateVerificationResult;
import kz.eco.signature.verification.CertificateVerificationService;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.PrepareSigningResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.SignatureResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.SubmitSignatureRequest;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.signing.CmsCertificateExtractor;
import kz.ecoprogress.documentflow.signing.CmsCertificateInfo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * prepare-signing / submitSignature flow. Certificate hardening (chain/CRL/OCSP/TSA, module spec
 * item 5) runs via {@link CertificateVerificationService} - disabled/NOT_CONFIGURED by default
 * (no trust store or CRL/OCSP endpoint ships with this project), so today's behavior is
 * unchanged until an operator configures real values, but the checks are real and every outcome
 * is persisted on the signature row, never faked as "passed". CERTIFICATE_REVOKED is now a real,
 * reachable outcome (only when CRL or OCSP returns a definitive revoked result) - everything else
 * (NOT_CONFIGURED/CHECK_ERROR) is recorded but does not block signing (fail-open).
 */
@Service
public class SignatureDocumentSigningService {

    private final SignatureDocumentRepository documentRepository;
    private final SignatureDocumentSigningSessionRepository sessionRepository;
    private final SignatureDocumentSignatureRepository signatureRepository;
    private final SignatureVerificationService signatureVerificationService;
    private final CertificateVerificationService certificateVerificationService;
    private final FileStorageService fileStorageService;
    private final SignatureDocumentAuditService auditService;
    private final SignatureDocumentService documentService;
    private final EdsSigningPolicyService edsSigningPolicyService;
    private final long sessionTtlMinutes;
    /** Module fix item 5: fail-open (accepting NOT_CONFIGURED/CHECK_ERROR trust status) is only
     *  acceptable when a real trust store and CRL/OCSP aren't set up yet. A production deployment
     *  must set eco.signature.strict-verification-required=true so a signature whose trust chain
     *  or revocation status genuinely could not be established is rejected outright instead of
     *  silently accepted. */
    private final boolean strictVerificationRequired;

    public SignatureDocumentSigningService(SignatureDocumentRepository documentRepository,
                                            SignatureDocumentSigningSessionRepository sessionRepository,
                                            SignatureDocumentSignatureRepository signatureRepository,
                                            SignatureVerificationService signatureVerificationService,
                                            CertificateVerificationService certificateVerificationService,
                                            FileStorageService fileStorageService,
                                            SignatureDocumentAuditService auditService,
                                            SignatureDocumentService documentService,
                                            EdsSigningPolicyService edsSigningPolicyService,
                                            @Value("${eco.signaturedoc.signing-session-ttl-minutes:15}") long sessionTtlMinutes,
                                            @Value("${eco.signature.strict-verification-required:false}") boolean strictVerificationRequired) {
        this.documentRepository = documentRepository;
        this.sessionRepository = sessionRepository;
        this.signatureRepository = signatureRepository;
        this.signatureVerificationService = signatureVerificationService;
        this.certificateVerificationService = certificateVerificationService;
        this.fileStorageService = fileStorageService;
        this.auditService = auditService;
        this.documentService = documentService;
        this.edsSigningPolicyService = edsSigningPolicyService;
        this.sessionTtlMinutes = sessionTtlMinutes;
        this.strictVerificationRequired = strictVerificationRequired;
    }

    @Transactional
    public PrepareSigningResponse prepareSigning(Long id, User actor, boolean adminExtendedAccess) {
        SignatureDocument document = documentService.getScoped(id, actor, adminExtendedAccess);
        requireOwner(document, actor);
        if (document.getStatus() == SignatureDocumentStatus.SIGNED) {
            throw new ConflictException("Документ уже подписан", "DOCUMENT_ALREADY_SIGNED");
        }
        if (document.getStatus().canTransitionTo(SignatureDocumentStatus.AWAITING_SIGNATURE)) {
            document.setStatus(SignatureDocumentStatus.AWAITING_SIGNATURE);
            document = documentRepository.save(document);
            // @Version is only incremented by Hibernate during an actual flush - without forcing
            // one here, document.getVersion() below (used for both the session and the response
            // sent to the client) would read the stale pre-flush value, causing every subsequent
            // submitSignature call to spuriously fail with DOCUMENT_VERSION_CONFLICT the moment any
            // other query in this same transaction triggers an auto-flush first.
            documentRepository.flush();
        }

        SignatureDocumentSigningSession session = new SignatureDocumentSigningSession();
        session.setId(UUID.randomUUID().toString());
        session.setDocumentId(document.getId());
        session.setDocumentVersion((int) document.getVersion());
        session.setSha256(document.getSha256());
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(sessionTtlMinutes);
        session.setExpiresAt(expiresAt);
        sessionRepository.save(session);

        auditService.record(document.getId(), "PREPARE_SIGNING", actor.getId(), null, null, null, true, null);
        return new PrepareSigningResponse(session.getId(), document.getId(), document.getVersion(),
                document.getSha256(), "/api/staff/signature-documents/" + document.getId() + "/content",
                "DETACHED_CMS", expiresAt);
    }

    @Transactional
    public SignatureResponse submitSignature(Long id, User actor, boolean adminExtendedAccess,
                                              SubmitSignatureRequest request) {
        SignatureDocument document = documentService.getScoped(id, actor, adminExtendedAccess);
        requireOwner(document, actor);

        SignatureDocumentSigningSession session = sessionRepository.findById(request.signingSessionId())
                .orElseThrow(() -> new BadRequestException("Сессия подписания не найдена", "SIGNING_SESSION_EXPIRED"));
        if (!session.getDocumentId().equals(document.getId())) {
            throw new BadRequestException("Сессия подписания относится к другому документу", "SIGNING_SESSION_EXPIRED");
        }
        if (session.isConsumed()) {
            throw new BadRequestException("Сессия подписания уже использована", "SIGNING_SESSION_EXPIRED");
        }
        if (session.isExpired()) {
            // P1 module fix item 6: an expired signing session must not leave the document
            // permanently parked in AWAITING_SIGNATURE - revert to DRAFT (a real, already-allowed
            // transition, see SignatureDocumentStatus) so the owner can simply re-edit/re-upload
            // and call prepare-signing again, rather than being stuck in a limbo status.
            if (document.getStatus() == SignatureDocumentStatus.AWAITING_SIGNATURE) {
                document.setStatus(SignatureDocumentStatus.DRAFT);
                documentRepository.save(document);
            }
            auditService.record(document.getId(), "SIGN_REJECTED", actor.getId(), null, null, null, false,
                    "SIGNING_SESSION_EXPIRED");
            throw new BadRequestException("Срок действия сессии подписания истёк", "SIGNING_SESSION_EXPIRED");
        }
        if (document.getStatus() == SignatureDocumentStatus.SIGNED) {
            throw new ConflictException("Документ уже подписан", "DOCUMENT_ALREADY_SIGNED");
        }
        if (session.getDocumentVersion() != request.version() || document.getVersion() != request.version()) {
            fail(document, actor, "DOCUMENT_VERSION_CONFLICT");
            throw new ConflictException("Версия документа изменилась, повторите подготовку к подписанию",
                    "DOCUMENT_VERSION_CONFLICT");
        }
        if (!session.getSha256().equalsIgnoreCase(request.sha256())) {
            fail(document, actor, "DOCUMENT_HASH_MISMATCH");
            throw new ConflictException("Хэш документа не совпадает с зафиксированным при подготовке к подписанию",
                    "DOCUMENT_HASH_MISMATCH");
        }

        byte[] actualBytes = loadBytes(document);
        String actualHash = SignatureDocumentService.sha256Hex(actualBytes);
        if (!actualHash.equalsIgnoreCase(document.getSha256())) {
            fail(document, actor, "DOCUMENT_HASH_MISMATCH");
            throw new ConflictException("Сохранённый файл документа не совпадает с ожидаемым хэшем",
                    "DOCUMENT_HASH_MISMATCH");
        }

        if (actor.getIin() == null || actor.getIin().isBlank()) {
            fail(document, actor, "CERTIFICATE_PROFILE_NOT_LINKED");
            throw new BadRequestException(
                    "К вашей учётной записи не привязан ИИН - обратитесь к администратору перед подписанием",
                    "CERTIFICATE_PROFILE_NOT_LINKED");
        }

        CmsCertificateInfo certInfo;
        try {
            certInfo = CmsCertificateExtractor.extract(request.cmsBase64());
        } catch (BadRequestException e) {
            fail(document, actor, "INVALID_CMS_SIGNATURE");
            throw new BadRequestException(e.getMessage(), "INVALID_CMS_SIGNATURE");
        }
        LocalDate today = LocalDate.now();
        if (certInfo.isExpiredOn(today) || certInfo.isNotYetValidOn(today)) {
            fail(document, actor, "CERTIFICATE_EXPIRED");
            persistFailedSignature(document, actor, request, certInfo, null,
                    SignatureDocumentVerificationStatus.CERTIFICATE_EXPIRED, "Сертификат вне периода действия");
            throw new BadRequestException("Сертификат подписанта вне периода действия", "CERTIFICATE_EXPIRED");
        }

        SignatureInfo signatureInfo;
        try {
            signatureInfo = signatureVerificationService.verifyDocument(request.cmsBase64(), actualBytes);
        } catch (BadRequestException e) {
            fail(document, actor, "SIGNATURE_VERIFICATION_FAILED");
            throw new BadRequestException(e.getMessage(), "SIGNATURE_VERIFICATION_FAILED");
        }
        if (!signatureInfo.verified()) {
            fail(document, actor, "SIGNATURE_VERIFICATION_FAILED");
            throw new BadRequestException("Подпись недействительна", "SIGNATURE_VERIFICATION_FAILED");
        }

        // Module spec item 6: NCA certs commonly embed the subject serial number as "IIN123456789012"
        // - strip a leading "IIN" (any case) and any non-digit characters from both sides before
        // comparing, so a raw exact-string mismatch doesn't spuriously reject a legitimately-owned
        // certificate.
        String certificateIin = EdsSigningPolicyService.normalizeIin(signatureInfo.serialNumber());
        String actorIin = EdsSigningPolicyService.normalizeIin(actor.getIin());
        if (certificateIin == null || certificateIin.isBlank() || !certificateIin.equals(actorIin)) {
            fail(document, actor, "CERTIFICATE_OWNER_MISMATCH");
            throw new BadRequestException(
                    "ИИН в сертификате подписи не совпадает с ИИН пользователя", "CERTIFICATE_OWNER_MISMATCH");
        }

        // Certificate hardening (module spec item 5): chain/CRL/OCSP/TSA. Fail-open except for a
        // definitive, positive revocation result - see CertificateVerificationService javadoc.
        CertificateVerificationResult certVerification =
                certificateVerificationService.verify(request.cmsBase64(), actualBytes, request.tsaTimestampBase64());
        if (certVerification.revoked()) {
            fail(document, actor, "CERTIFICATE_REVOKED");
            persistFailedSignature(document, actor, request, certInfo, signatureInfo, certVerification,
                    SignatureDocumentVerificationStatus.CERTIFICATE_REVOKED, certVerification.revocationDetail());
            throw new BadRequestException(
                    certVerification.revocationDetail() != null ? certVerification.revocationDetail() : "Сертификат отозван",
                    "CERTIFICATE_REVOKED");
        }
        if (strictVerificationRequired && !certVerification.trustFullyVerified()) {
            fail(document, actor, "CERTIFICATE_TRUST_NOT_VERIFIED");
            persistFailedSignature(document, actor, request, certInfo, signatureInfo, certVerification,
                    SignatureDocumentVerificationStatus.TRUST_NOT_VERIFIED,
                    "Не удалось подтвердить цепочку доверия или статус отзыва сертификата");
            throw new BadRequestException(
                    "Не удалось подтвердить цепочку доверия или статус отзыва сертификата - подписание отклонено",
                    "CERTIFICATE_TRUST_NOT_VERIFIED");
        }

        String cmsStorageId;
        try {
            byte[] cmsBytes = Base64.getDecoder().decode(request.cmsBase64().replaceAll("\\s+", ""));
            StoredFileMetadata cmsFile = fileStorageService.storeBytes(cmsBytes,
                    document.getOriginalFileName() + ".p7s", "application/pkcs7-signature",
                    "signature-document-cms", String.valueOf(actor.getId()));
            cmsStorageId = cmsFile.fileId();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить файл подписи", e);
        }

        SignatureDocumentSignature signature = persistSignature(document, actor, request, certInfo,
                signatureInfo, certVerification, cmsStorageId, SignatureDocumentVerificationStatus.VERIFIED, null);

        document.setStatus(SignatureDocumentStatus.SIGNED);
        document.setSignedAt(LocalDateTime.now());
        documentRepository.save(document);
        session.setConsumedAt(LocalDateTime.now());
        sessionRepository.save(session);

        auditService.record(document.getId(), "SIGN_SUCCESS", actor.getId(), null, null, null, true, null);
        return toResponse(signature);
    }

    /** Not exposed as its own endpoint (module spec: keep only the 6 listed routes) - used
     *  internally by the controller's idempotent-retry lookup for POST /{id}/signatures. */
    @Transactional(readOnly = true)
    List<SignatureResponse> listSignatures(Long id, User actor, boolean adminExtendedAccess) {
        SignatureDocument document = documentService.getScoped(id, actor, adminExtendedAccess);
        return signatureRepository.findByDocumentIdOrderByCreatedAtDesc(document.getId())
                .stream().map(SignatureDocumentSigningService::toResponse).toList();
    }

    /** canViewCrossOwner (ADMIN, via adminExtendedAccess/documentService.getScoped) is deliberately
     *  narrower than canSign: ADMIN may open/download another employee's document, but signing is
     *  a personal act tied to the signer's own certificate - only the document's owner may ever
     *  sign it, regardless of role. */
    private void requireOwner(SignatureDocument document, User actor) {
        if (!document.getCreatedByUserId().equals(actor.getId())) {
            throw new AccessDeniedException("Подписать документ может только его владелец");
        }
    }

    private byte[] loadBytes(SignatureDocument document) {
        try {
            StoredFileContent content = fileStorageService.load(document.getStorageFileId());
            try (var in = content.inputStream()) {
                return in.readAllBytes();
            }
        } catch (IOException e) {
            throw new SignatureDocumentStorageException("Не удалось загрузить документ", e);
        }
    }

    /** A failed signature attempt does NOT push the document into a hard terminal state - it stays
     *  AWAITING_SIGNATURE (or is reset back to it) so the employee can retry with a fresh
     *  prepare-signing call. SIGNATURE_FAILED is recorded on the audit log only. */
    private void fail(SignatureDocument document, User actor, String errorCode) {
        if (document.getStatus() != SignatureDocumentStatus.AWAITING_SIGNATURE) {
            document.setStatus(SignatureDocumentStatus.AWAITING_SIGNATURE);
            documentRepository.save(document);
        }
        auditService.record(document.getId(), "SIGN_REJECTED", actor.getId(), null, null, null, false, errorCode);
    }

    private SignatureDocumentSignature persistFailedSignature(SignatureDocument document, User actor,
            SubmitSignatureRequest request, CmsCertificateInfo certInfo, SignatureInfo signatureInfo,
            SignatureDocumentVerificationStatus status, String message) {
        return persistSignature(document, actor, request, certInfo, signatureInfo, null, null, status, message);
    }

    private SignatureDocumentSignature persistFailedSignature(SignatureDocument document, User actor,
            SubmitSignatureRequest request, CmsCertificateInfo certInfo, SignatureInfo signatureInfo,
            CertificateVerificationResult certVerification,
            SignatureDocumentVerificationStatus status, String message) {
        return persistSignature(document, actor, request, certInfo, signatureInfo, certVerification, null, status, message);
    }

    private SignatureDocumentSignature persistSignature(SignatureDocument document, User actor,
            SubmitSignatureRequest request, CmsCertificateInfo certInfo, SignatureInfo signatureInfo,
            CertificateVerificationResult certVerification, String cmsStorageId,
            SignatureDocumentVerificationStatus status, String message) {
        SignatureDocumentSignature signature = new SignatureDocumentSignature();
        signature.setDocumentId(document.getId());
        signature.setDocumentVersion((int) request.version());
        signature.setSignerUserId(actor.getId());
        signature.setCmsStorageId(cmsStorageId);
        if (signatureInfo != null) {
            signature.setCertificateSubject(signatureInfo.subjectDN());
            signature.setCertificateIin(signatureInfo.serialNumber());
        }
        if (certInfo != null) {
            signature.setCertificateValidFrom(certInfo.notBefore());
            signature.setCertificateValidTo(certInfo.notAfter());
        }
        if (certVerification != null) {
            signature.setChainStatus(certVerification.chainStatus().name());
            signature.setCrlStatus(certVerification.crlStatus().name());
            signature.setOcspStatus(certVerification.ocspStatus().name());
            signature.setTsaStatus(certVerification.tsaStatus().name());
        }
        signature.setSignatureAlgorithm("SHA256withRSA (CMS/CAdES)");
        signature.setFileSha256(document.getSha256());
        signature.setVerificationStatus(status);
        signature.setVerificationMessage(message);
        signature.setSignedAt(LocalDateTime.now());
        return signatureRepository.save(signature);
    }

    private static SignatureResponse toResponse(SignatureDocumentSignature s) {
        return new SignatureResponse(s.getId(), s.getDocumentId(), s.getDocumentVersion(), s.getSignerUserId(),
                s.getCertificateSerialNumber(), s.getCertificateSubject(), s.getCertificateIssuer(),
                s.getCertificateIin(), s.getCertificateBin(),
                s.getCertificateValidFrom() == null ? null : s.getCertificateValidFrom().toString(),
                s.getCertificateValidTo() == null ? null : s.getCertificateValidTo().toString(),
                s.getSignatureAlgorithm(), s.getVerificationStatus().name(), s.getVerificationMessage(),
                s.getSignedAt());
    }
}
