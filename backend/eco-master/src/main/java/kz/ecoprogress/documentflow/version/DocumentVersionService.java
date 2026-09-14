package kz.ecoprogress.documentflow.version;

import kz.eco.common.exception.BadRequestException;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowPermission;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentRepository;
import kz.ecoprogress.documentflow.document.DocumentTypeConfig;
import kz.ecoprogress.documentflow.document.DocumentTypeRegistry;
import kz.ecoprogress.documentflow.document.exception.DocumentNotEditableException;
import kz.ecoprogress.documentflow.document.exception.DocumentNotFoundException;
import kz.ecoprogress.documentflow.document.exception.VersionConflictException;
import kz.ecoprogress.documentflow.document.exception.VersionLockedException;
import kz.ecoprogress.documentflow.plan.FeatureCode;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Owns the document_flow_document_versions lifecycle. Agent C calls {@link #lock(Long)} right
 * before sending a document for signing (freezing the file that gets signed) and reads
 * {@link DocumentVersion#getSha256Hash()}/{@link DocumentVersion#isLocked()} via
 * {@link DocumentVersionRepository} to verify what's being signed hasn't silently changed.
 */
@Service
public class DocumentVersionService {

    private final DocumentVersionRepository versionRepository;
    private final DocumentRepository documentRepository;
    private final FileStorageService fileStorageService;
    private final DocumentFlowAccessService accessService;

    public DocumentVersionService(DocumentVersionRepository versionRepository,
                                   DocumentRepository documentRepository,
                                   FileStorageService fileStorageService,
                                   DocumentFlowAccessService accessService) {
        this.versionRepository = versionRepository;
        this.documentRepository = documentRepository;
        this.fileStorageService = fileStorageService;
        this.accessService = accessService;
    }

    @Transactional
    public DocumentVersion createVersion(Long documentId, Long organizationId, MultipartFile file,
                                          String changeReason, Long userId) {
        accessService.requireWriteAccess(userId, organizationId);
        accessService.requireFeature(organizationId, FeatureCode.VERSIONING);
        if (!accessService.hasPermission(userId, organizationId, DocumentFlowPermission.EDIT_DOCUMENT)) {
            throw new ForbiddenException("Недостаточно прав для загрузки версии документа", "VERSION_EDIT_FORBIDDEN");
        }
        Document document = documentRepository.findByIdAndOrganizationId(documentId, organizationId)
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
        if (!document.getStatus().isEditable()) {
            throw new DocumentNotEditableException(
                    "Документ в статусе " + document.getStatus() + " недоступен для загрузки новой версии");
        }

        DocumentTypeConfig config = DocumentTypeRegistry.require(document.getDocumentType());
        validateFile(file, config);

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Не удалось прочитать файл");
        }
        String sha256 = Sha256Utils.sha256Hex(content);

        StoredFileMetadata stored;
        try {
            stored = fileStorageService.storeBytes(content, file.getOriginalFilename(), file.getContentType(),
                    "document-flow-version:" + documentId, String.valueOf(userId));
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить файл версии документа", e);
        }

        versionRepository.findByDocumentIdAndCurrentTrue(documentId).ifPresent(previous -> {
            previous.setCurrent(false);
            versionRepository.save(previous);
        });

        int nextVersionNumber = versionRepository.countByDocumentId(documentId) + 1;

        DocumentVersion version = new DocumentVersion();
        version.setDocumentId(documentId);
        version.setVersionNumber(nextVersionNumber);
        version.setStorageKey(stored.fileId());
        version.setOriginalFileName(file.getOriginalFilename());
        version.setMimeType(file.getContentType());
        version.setFileSize(stored.size());
        version.setSha256Hash(sha256);
        version.setChangeReason(changeReason);
        version.setCurrent(true);
        version.setLocked(false);
        version.setCreatedBy(userId);
        try {
            version = versionRepository.saveAndFlush(version);
        } catch (DataIntegrityViolationException e) {
            // uk_dfdv_document_version (V51) tripped - two concurrent uploads raced on the same
            // next version_number. Surface as a normal conflict rather than a raw DB exception.
            throw new VersionConflictException(
                    "Версия документа уже была создана параллельным запросом, повторите попытку");
        }

        document.setCurrentVersionId(version.getId());
        documentRepository.save(document);

        return version;
    }

    /** Current version of the document - the one Agent C's signing flows sign against. */
    @Transactional(readOnly = true)
    public DocumentVersion getCurrentVersion(Long documentId) {
        return versionRepository.findByDocumentIdAndCurrentTrue(documentId)
                .orElseThrow(() -> new DocumentNotFoundException("У документа нет текущей версии"));
    }

    /** Loads the raw file bytes of a version from storage - used to compute/verify sha256 hashes
     *  and to build the signed package. */
    @Transactional(readOnly = true)
    public byte[] loadBytes(Long versionId) {
        DocumentVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена"));
        try {
            return fileStorageService.load(version.getStorageKey()).inputStream().readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось прочитать файл версии документа", e);
        }
    }

    /** Idempotent: locking an already-locked version is a no-op, not an error - Agent C's
     *  send-for-signing flow can call this without first checking current lock state. */
    @Transactional
    public DocumentVersion lock(Long versionId) {
        DocumentVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена"));
        if (version.isLocked()) {
            return version;
        }
        version.setLocked(true);
        version.setLockedAt(LocalDateTime.now());
        return versionRepository.save(version);
    }

    /** Idempotent: locking an already-locked version is a no-op, not an error. */
    @Transactional
    public DocumentVersion lock(Long versionId, Long lockedByUserId) {
        DocumentVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена"));
        if (version.isLocked()) {
            return version;
        }
        version.setLocked(true);
        version.setLockedAt(LocalDateTime.now());
        version.setLockedBy(lockedByUserId);
        return versionRepository.save(version);
    }

    /**
     * Replaces the file/hash/storageKey of an EXISTING version row in place (e.g. correcting a
     * mistaken upload before it's sent for signing) rather than appending a new version. Once
     * {@link DocumentVersion#isLocked()} is true this always throws {@link VersionLockedException}
     * - a locked row must stay byte-for-byte immutable in practice, since Agent C's signature
     * records point at its exact sha256Hash.
     */
    @Transactional
    public DocumentVersion replaceFile(Long versionId, MultipartFile file, Long userId) {
        DocumentVersion version = versionRepository.findById(versionId)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена"));
        if (version.isLocked()) {
            throw new VersionLockedException("Версия документа заблокирована и не может быть изменена");
        }

        Document document = documentRepository.findById(version.getDocumentId())
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
        accessService.requireWriteAccess(userId, document.getOrganizationId());
        accessService.requireFeature(document.getOrganizationId(), FeatureCode.VERSIONING);
        if (!accessService.hasPermission(userId, document.getOrganizationId(), DocumentFlowPermission.EDIT_DOCUMENT)) {
            throw new ForbiddenException("Недостаточно прав для изменения версии документа", "VERSION_EDIT_FORBIDDEN");
        }
        DocumentTypeConfig config = DocumentTypeRegistry.require(document.getDocumentType());
        validateFile(file, config);

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Не удалось прочитать файл");
        }
        StoredFileMetadata stored;
        try {
            stored = fileStorageService.storeBytes(content, file.getOriginalFilename(), file.getContentType(),
                    "document-flow-version:" + version.getDocumentId(), String.valueOf(userId));
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить файл версии документа", e);
        }

        version.setStorageKey(stored.fileId());
        version.setOriginalFileName(file.getOriginalFilename());
        version.setMimeType(file.getContentType());
        version.setFileSize(stored.size());
        version.setSha256Hash(Sha256Utils.sha256Hex(content));
        return versionRepository.save(version);
    }

    private void validateFile(MultipartFile file, DocumentTypeConfig config) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не может быть пустым");
        }
        if (file.getSize() > config.maxSizeBytes()) {
            throw new BadRequestException("Размер файла превышает допустимый лимит для типа документа "
                    + config.type());
        }
        String contentType = file.getContentType();
        if (contentType == null || config.allowedMimeTypes().stream().noneMatch(contentType::equalsIgnoreCase)) {
            throw new BadRequestException("Недопустимый тип файла: " + contentType);
        }
    }
}
