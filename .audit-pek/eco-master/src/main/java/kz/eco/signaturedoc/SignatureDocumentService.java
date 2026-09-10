package kz.eco.signaturedoc;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.DocumentListResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.DocumentResponse;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Upload / list / read for signature documents. Simplified module: no organization/company
 * tenant scoping (see SignatureDocumentController javadoc) - visibility is own-documents-only,
 * with ADMIN able to see everyone's. Signing itself lives in SignatureDocumentSigningService.
 */
@Service
public class SignatureDocumentService {

    private final SignatureDocumentRepository repository;
    private final FileStorageService fileStorageService;
    private final SignatureDocumentAuditService auditService;
    private final long maxFileSizeBytes;

    public SignatureDocumentService(SignatureDocumentRepository repository,
                                     FileStorageService fileStorageService,
                                     SignatureDocumentAuditService auditService,
                                     @Value("${eco.signaturedoc.max-file-size-bytes:26214400}") long maxFileSizeBytes) {
        this.repository = repository;
        this.fileStorageService = fileStorageService;
        this.auditService = auditService;
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    @Transactional
    public DocumentResponse upload(User actor, String title, String description,
                                    String originalFileName, String declaredContentType, byte[] content) {
        try {
            SignatureDocumentFileValidator.validate(originalFileName, declaredContentType, content, maxFileSizeBytes);
        } catch (BadRequestException e) {
            auditService.record(null, "UPLOAD", actor.getId(), null, null, null, false, e.getCode());
            throw e;
        }
        String safeFileName = SignatureDocumentFileValidator.sanitizeFileName(originalFileName);
        String sha256 = sha256Hex(content);

        StoredFileMetadata stored;
        try {
            stored = fileStorageService.storeBytes(content, safeFileName, declaredContentType,
                    "signature-document", String.valueOf(actor.getId()));
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить файл", e);
        }

        SignatureDocument document = new SignatureDocument();
        document.setCreatedByUserId(actor.getId());
        document.setTitle(title != null && !title.isBlank() ? title.trim() : safeFileName);
        document.setDescription(description);
        document.setOriginalFileName(safeFileName);
        document.setMimeType(declaredContentType != null ? declaredContentType : "application/octet-stream");
        document.setFileSize(content.length);
        document.setStorageFileId(stored.fileId());
        document.setSha256(sha256);
        document.setStatus(SignatureDocumentStatus.DRAFT);
        try {
            document = repository.save(document);
        } catch (RuntimeException e) {
            // The file was already written to storage before this DB save was attempted - if the
            // row never lands (constraint violation, connection drop, ...), that file becomes an
            // orphan nothing will ever reference or clean up. Module fix: always remove it here
            // rather than leaking storage forever.
            fileStorageService.delete(stored.fileId());
            throw e;
        }

        auditService.record(document.getId(), "UPLOAD", actor.getId(), null, null, null, true, null);
        return toResponse(document);
    }

    @Transactional(readOnly = true)
    public DocumentListResponse list(User actor, boolean adminExtendedAccess, Pageable pageable) {
        Page<SignatureDocument> page = adminExtendedAccess
                ? repository.findAll(pageable)
                : repository.findByCreatedByUserId(actor.getId(), pageable);
        return new DocumentListResponse(
                page.getContent().stream().map(SignatureDocumentService::toResponse).toList(),
                page.getTotalElements(), page.getTotalPages(), page.getNumber(), page.getSize());
    }

    @Transactional(readOnly = true)
    public SignatureDocument getScoped(Long id, User actor, boolean adminExtendedAccess) {
        SignatureDocument document = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Документ не найден", "DOCUMENT_NOT_FOUND"));
        requireAccess(document, actor, adminExtendedAccess);
        return document;
    }

    @Transactional(readOnly = true)
    public StoredFileContent getContent(Long id, User actor, boolean adminExtendedAccess) {
        SignatureDocument document = getScoped(id, actor, adminExtendedAccess);
        try {
            StoredFileContent content = fileStorageService.load(document.getStorageFileId());
            auditService.record(document.getId(), "DOWNLOAD_ORIGINAL", actor.getId(), null, null, null, true, null);
            return content;
        } catch (IOException e) {
            throw new SignatureDocumentStorageException("Не удалось загрузить файл", e);
        }
    }

    /** Ownership check: own documents only, unless the caller has the separately-gated extended
     *  admin-view permission - never a blanket "ADMIN sees everything" bypass that isn't
     *  explicitly checked. No company/organization dimension anymore (module spec). */
    void requireAccess(SignatureDocument document, User actor, boolean adminExtendedAccess) {
        if (!adminExtendedAccess && !document.getCreatedByUserId().equals(actor.getId())) {
            throw new NotFoundException("Документ не найден", "DOCUMENT_ACCESS_DENIED");
        }
    }

    static DocumentResponse toResponse(SignatureDocument d) {
        return new DocumentResponse(d.getId(), d.getCreatedByUserId(), d.getTitle(),
                d.getDescription(), d.getOriginalFileName(), d.getMimeType(), d.getFileSize(), d.getSha256(),
                d.getStatus().name(), d.getVersion(), d.getCreatedAt(), d.getUpdatedAt(), d.getSignedAt());
    }

    static String sha256Hex(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 недоступен", e);
        }
    }
}
