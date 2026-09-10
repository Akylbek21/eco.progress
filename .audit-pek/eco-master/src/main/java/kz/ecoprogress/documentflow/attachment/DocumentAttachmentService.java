package kz.ecoprogress.documentflow.attachment;

import kz.eco.common.exception.BadRequestException;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentRepository;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.document.exception.DocumentNotEditableException;
import kz.ecoprogress.documentflow.document.exception.DocumentNotFoundException;
import kz.ecoprogress.documentflow.version.Sha256Utils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
public class DocumentAttachmentService {

    private final DocumentAttachmentRepository attachmentRepository;
    private final DocumentRepository documentRepository;
    private final FileStorageService fileStorageService;
    private final DocumentFlowAccessService accessService;

    public DocumentAttachmentService(DocumentAttachmentRepository attachmentRepository,
                                      DocumentRepository documentRepository,
                                      FileStorageService fileStorageService,
                                      DocumentFlowAccessService accessService) {
        this.attachmentRepository = attachmentRepository;
        this.documentRepository = documentRepository;
        this.fileStorageService = fileStorageService;
        this.accessService = accessService;
    }

    @Transactional
    public DocumentAttachment upload(Long documentId, Long organizationId, MultipartFile file, Long userId) {
        Document document = documentRepository.findByIdAndOrganizationId(documentId, organizationId)
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не может быть пустым");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Не удалось прочитать файл");
        }
        StoredFileMetadata stored;
        try {
            stored = fileStorageService.storeBytes(content, file.getOriginalFilename(), file.getContentType(),
                    "document-flow-attachment:" + documentId, String.valueOf(userId));
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить вложение", e);
        }

        DocumentAttachment attachment = new DocumentAttachment();
        attachment.setDocumentId(documentId);
        attachment.setStorageKey(stored.fileId());
        attachment.setOriginalFileName(file.getOriginalFilename());
        attachment.setMimeType(file.getContentType());
        attachment.setFileSize(stored.size());
        attachment.setSha256Hash(Sha256Utils.sha256Hex(content));
        attachment.setUploadedBy(userId);
        return attachmentRepository.save(attachment);
    }

    @Transactional(readOnly = true)
    public List<DocumentAttachment> list(Long documentId, Long organizationId) {
        documentRepository.findByIdAndOrganizationId(documentId, organizationId)
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
        return attachmentRepository.findByDocumentId(documentId);
    }

    /** Deletion allowed ONLY while the parent document is DRAFT and editable - enforced both via
     *  the access service's requireWriteAccess AND a direct status check, per spec (defense in
     *  depth: even if access-service semantics change, a non-DRAFT document's attachments stay
     *  immutable). */
    @Transactional
    public void delete(Long documentId, Long organizationId, Long attachmentId, Long userId) {
        accessService.requireWriteAccess(userId, organizationId);
        Document document = documentRepository.findByIdAndOrganizationId(documentId, organizationId)
                .orElseThrow(() -> new DocumentNotFoundException("Документ не найден"));
        if (document.getStatus() != DocumentStatus.DRAFT) {
            throw new DocumentNotEditableException("Вложения можно удалять только у документа в статусе DRAFT");
        }
        DocumentAttachment attachment = attachmentRepository.findByIdAndDocumentId(attachmentId, documentId)
                .orElseThrow(() -> new DocumentNotFoundException("Вложение не найдено"));
        attachmentRepository.delete(attachment);
    }
}
