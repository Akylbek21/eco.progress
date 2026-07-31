package kz.ecoprogress.documentflow.document;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.BadRequestException;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.OrganizationResolver;
import kz.ecoprogress.documentflow.attachment.DocumentAttachment;
import kz.ecoprogress.documentflow.attachment.DocumentAttachmentService;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import kz.ecoprogress.documentflow.document.exception.DocumentNotFoundException;
import kz.ecoprogress.documentflow.version.DocumentVersion;
import kz.ecoprogress.documentflow.version.DocumentVersionRepository;
import kz.ecoprogress.documentflow.version.DocumentVersionService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/document-flow")
public class DocumentController {

    private final DocumentService documentService;
    private final DocumentVersionService documentVersionService;
    private final DocumentVersionRepository documentVersionRepository;
    private final DocumentAttachmentService documentAttachmentService;
    private final FileStorageService fileStorageService;
    private final OrganizationResolver organizationResolver;

    public DocumentController(DocumentService documentService,
                               DocumentVersionService documentVersionService,
                               DocumentVersionRepository documentVersionRepository,
                               DocumentAttachmentService documentAttachmentService,
                               FileStorageService fileStorageService,
                               OrganizationResolver organizationResolver) {
        this.documentService = documentService;
        this.documentVersionService = documentVersionService;
        this.documentVersionRepository = documentVersionRepository;
        this.documentAttachmentService = documentAttachmentService;
        this.fileStorageService = fileStorageService;
        this.organizationResolver = organizationResolver;
    }

    @GetMapping("/document-types")
    public ApiResponse<List<DocumentTypeConfig>> documentTypes() {
        return ApiResponse.ok(DocumentTypeRegistry.findActive());
    }

    @PostMapping("/documents")
    public ApiResponse<DocumentDtos.DocumentDetailDto> create(
            @RequestBody DocumentDtos.CreateDocumentRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User user = CurrentUser.get();
        Long organizationId = organizationResolver.resolve(user.getId(), request.organizationId());
        Document document = documentService.create(request, user.getId(), organizationId, idempotencyKey);
        return ApiResponse.ok(documentService.toDetailDto(document, user.getId(), organizationId));
    }

    @GetMapping("/documents")
    public ApiResponse<PageResponse<DocumentDtos.DocumentListItemDto>> list(
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) DocumentDirection direction,
            @RequestParam(required = false) DocumentType type,
            @RequestParam(required = false) DocumentStatus status,
            @RequestParam(required = false) Long counterpartyId,
            @RequestParam(required = false) Long authorId,
            @RequestParam(required = false) Long signerId,
            @RequestParam(required = false) Boolean requiresMySignature,
            @RequestParam(required = false) Boolean overdue,
            @RequestParam(required = false) LocalDate createdFrom,
            @RequestParam(required = false) LocalDate createdTo,
            @RequestParam(required = false) LocalDate deadlineFrom,
            @RequestParam(required = false) LocalDate deadlineTo,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        DocumentFilter filter = new DocumentFilter(direction, type, status, counterpartyId, authorId, signerId,
                requiresMySignature, overdue, createdFrom, createdTo, deadlineFrom, deadlineTo, query);
        Pageable pageable = PageRequest.of(page, size, parseSort(sort));
        PageResponse<Document> documents = documentService.list(resolvedOrgId, filter, pageable);
        PageResponse<DocumentDtos.DocumentListItemDto> mapped = new PageResponse<>(
                documents.items().stream().map(d -> documentService.toListItemDto(d, user.getId(), resolvedOrgId)).toList(),
                documents.page(), documents.size(), documents.totalElements(), documents.totalPages(),
                documents.first(), documents.last(), documents.hasNext(), documents.hasPrevious());
        return ApiResponse.ok(mapped);
    }

    @GetMapping("/dashboard")
    public ApiResponse<DocumentDtos.DashboardResponse> dashboard(@RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(documentService.dashboard(resolvedOrgId));
    }

    @GetMapping("/documents/{id}")
    public ApiResponse<DocumentDtos.DocumentDetailDto> get(@PathVariable Long id,
                                                            @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        Document document = documentService.get(id, resolvedOrgId);
        return ApiResponse.ok(documentService.toDetailDto(document, user.getId(), resolvedOrgId));
    }

    @PatchMapping("/documents/{id}")
    public ApiResponse<DocumentDtos.DocumentDetailDto> update(@PathVariable Long id,
                                                               @RequestParam(required = false) Long organizationId,
                                                               @RequestBody DocumentDtos.UpdateDocumentRequest request) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        Document document = documentService.update(id, resolvedOrgId, user.getId(), request);
        return ApiResponse.ok(documentService.toDetailDto(document, user.getId(), resolvedOrgId));
    }

    @DeleteMapping("/documents/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        documentService.delete(id, resolvedOrgId, user.getId());
        return ApiResponse.message("Документ удален");
    }

    @PostMapping("/documents/{id}/file")
    public ApiResponse<DocumentVersion> uploadFile(@PathVariable Long id,
                                                    @RequestParam(required = false) Long organizationId,
                                                    @RequestPart("file") MultipartFile file,
                                                    @RequestParam(required = false) String changeReason) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        DocumentVersion version = documentVersionService.createVersion(id, resolvedOrgId, file, changeReason, user.getId());
        return ApiResponse.ok(version);
    }

    @GetMapping("/documents/{id}/preview")
    public ResponseEntity<InputStreamResource> preview(@PathVariable Long id,
                                                         @RequestParam(required = false) Long organizationId) throws IOException {
        return downloadCurrentVersion(id, organizationId, false);
    }

    @GetMapping("/documents/{id}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable Long id,
                                                          @RequestParam(required = false) Long organizationId) throws IOException {
        return downloadCurrentVersion(id, organizationId, true);
    }

    private ResponseEntity<InputStreamResource> downloadCurrentVersion(Long id, Long organizationId,
                                                                        boolean attachment) throws IOException {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        Document document = documentService.get(id, resolvedOrgId);
        if (document.getCurrentVersionId() == null) {
            throw new DocumentNotFoundException("У документа еще нет загруженной версии файла");
        }
        DocumentVersion version = documentVersionRepository.findByIdAndDocumentId(document.getCurrentVersionId(), id)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена"));
        return streamStoredFile(version.getStorageKey(), version.getOriginalFileName(), version.getMimeType(), attachment);
    }

    @PostMapping("/documents/{id}/attachments")
    public ApiResponse<DocumentAttachment> uploadAttachment(@PathVariable Long id,
                                                             @RequestParam(required = false) Long organizationId,
                                                             @RequestPart("file") MultipartFile file) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(documentAttachmentService.upload(id, resolvedOrgId, file, user.getId()));
    }

    @GetMapping("/documents/{id}/attachments")
    public ApiResponse<List<DocumentAttachment>> listAttachments(@PathVariable Long id,
                                                                  @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(documentAttachmentService.list(id, resolvedOrgId));
    }

    @DeleteMapping("/documents/{id}/attachments/{attachmentId}")
    public ApiResponse<Void> deleteAttachment(@PathVariable Long id, @PathVariable Long attachmentId,
                                               @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        documentAttachmentService.delete(id, resolvedOrgId, attachmentId, user.getId());
        return ApiResponse.message("Вложение удалено");
    }

    @PostMapping("/documents/{id}/versions")
    public ApiResponse<DocumentVersion> createVersion(@PathVariable Long id,
                                                       @RequestParam(required = false) Long organizationId,
                                                       @RequestPart("file") MultipartFile file,
                                                       @RequestParam(required = false) String changeReason) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        return ApiResponse.ok(documentVersionService.createVersion(id, resolvedOrgId, file, changeReason, user.getId()));
    }

    @GetMapping("/documents/{id}/versions")
    public ApiResponse<List<DocumentVersion>> listVersions(@PathVariable Long id,
                                                            @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        documentService.get(id, resolvedOrgId); // ownership check
        return ApiResponse.ok(documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(id));
    }

    @GetMapping("/documents/{id}/versions/{versionId}")
    public ApiResponse<DocumentVersion> getVersion(@PathVariable Long id, @PathVariable Long versionId,
                                                    @RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        documentService.get(id, resolvedOrgId); // ownership check
        return ApiResponse.ok(documentVersionRepository.findByIdAndDocumentId(versionId, id)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена")));
    }

    @GetMapping("/documents/{id}/versions/{versionId}/download")
    public ResponseEntity<InputStreamResource> downloadVersion(@PathVariable Long id, @PathVariable Long versionId,
                                                                @RequestParam(required = false) Long organizationId) throws IOException {
        User user = CurrentUser.get();
        Long resolvedOrgId = organizationResolver.resolve(user.getId(), organizationId);
        documentService.get(id, resolvedOrgId); // ownership check
        DocumentVersion version = documentVersionRepository.findByIdAndDocumentId(versionId, id)
                .orElseThrow(() -> new DocumentNotFoundException("Версия документа не найдена"));
        return streamStoredFile(version.getStorageKey(), version.getOriginalFileName(), version.getMimeType(), true);
    }

    private ResponseEntity<InputStreamResource> streamStoredFile(String storageKey, String filename,
                                                                   String mimeType, boolean attachment) throws IOException {
        StoredFileContent content = fileStorageService.load(storageKey);
        String disposition = (attachment ? "attachment" : "inline") + "; filename*=UTF-8''"
                + URLEncoder.encode(filename != null ? filename : content.filename(), StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(mimeType != null ? MediaType.parseMediaType(mimeType) : MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(new InputStreamResource(content.inputStream()));
    }

    private Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        String[] parts = sort.split(",");
        String property = parts[0].trim();
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        List<String> allowedProperties = List.of("createdAt", "updatedAt", "title", "status", "signingDeadline",
                "documentNumber");
        if (!allowedProperties.contains(property)) {
            throw new BadRequestException("Недопустимое поле сортировки: " + property);
        }
        return Sort.by(direction, property);
    }
}
