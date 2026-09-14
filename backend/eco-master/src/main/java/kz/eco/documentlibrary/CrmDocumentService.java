package kz.eco.documentlibrary;

import kz.eco.audit.AuditLogService;
import kz.eco.common.PageResponse;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.CategoryOption;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.CrmDocumentResponse;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.UpdateRequest;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.UploadedByResponse;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileContent;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service
public class CrmDocumentService {

    /** Roles allowed to edit/archive ANY document, not just their own upload - checked alongside
     *  ownership, never in place of it (see {@link #assertCanModify}). */
    private static final Set<UserRole> ELEVATED_ROLES = Set.of(UserRole.ADMIN, UserRole.DIRECTOR);

    private static final Set<String> PREVIEWABLE_MIME_PREFIXES_EXACT = Set.of("application/pdf");

    private final CrmDocumentRepository repository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final AuditLogService auditLogService;
    private final long maxFileSizeBytes;

    public CrmDocumentService(CrmDocumentRepository repository,
                               UserRepository userRepository,
                               FileStorageService fileStorageService,
                               AuditLogService auditLogService,
                               @Value("${eco.documentlibrary.max-file-size-bytes:20971520}") long maxFileSizeBytes) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.auditLogService = auditLogService;
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    @Transactional
    public CrmDocumentResponse upload(User actor, MultipartFile file, String title, String category,
                                       String comment, LocalDate documentDate) {
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new CrmDocumentStorageException("Не удалось прочитать загружаемый файл", e);
        }
        String originalFilename = CrmDocumentFileValidator.sanitizeFileName(
                file.getOriginalFilename() == null ? "" : file.getOriginalFilename());
        CrmDocumentFileValidator.validate(originalFilename, file.getContentType(), content, maxFileSizeBytes);

        StoredFileMetadata stored;
        try {
            stored = fileStorageService.storeBytes(content, originalFilename, file.getContentType(),
                    "crm-document-library", actor.getEmail());
        } catch (IOException e) {
            throw new CrmDocumentStorageException("Не удалось сохранить файл", e);
        }

        try {
            CrmDocument document = new CrmDocument();
            document.setTitle(title);
            document.setCategory(category);
            document.setComment(comment);
            document.setDocumentDate(documentDate);
            document.setFileId(stored.fileId());
            document.setOriginalFilename(originalFilename);
            document.setMimeType(stored.contentType() != null ? stored.contentType() : "application/octet-stream");
            document.setFileSize(stored.size());
            document.setUploadedByUserId(actor.getId());
            document = repository.save(document);
            auditLogService.log("CrmDocument", document.getId(), null, actor, "UPLOADED",
                    null, document.getTitle(), null);
            return toResponse(document, actor);
        } catch (RuntimeException e) {
            // Compensating cleanup: the file was already durably stored above, so a failure
            // persisting the DB row (e.g. a forced constraint violation) must not leave an
            // orphaned file behind in FileStorageService.
            fileStorageService.delete(stored.fileId());
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<CrmDocumentResponse> search(User actor, String q, String category,
                                                      Long uploadedByUserId, LocalDate dateFrom, LocalDate dateTo,
                                                      Pageable pageable) {
        Specification<CrmDocument> spec = Specification.where(CrmDocumentSpecifications.notArchived());
        spec = andIfPresent(spec, CrmDocumentSpecifications.category(category));
        spec = andIfPresent(spec, CrmDocumentSpecifications.uploadedByUserId(uploadedByUserId));
        spec = andIfPresent(spec, CrmDocumentSpecifications.dateFrom(dateFrom));
        spec = andIfPresent(spec, CrmDocumentSpecifications.dateTo(dateTo));
        spec = andIfPresent(spec, CrmDocumentSpecifications.search(q));
        Page<CrmDocument> page = repository.findAll(spec, pageable);
        return PageResponse.of(page, d -> toResponse(d, actor));
    }

    @Transactional(readOnly = true)
    public List<CategoryOption> categories() {
        return Arrays.stream(CrmDocumentCategory.values())
                .map(c -> new CategoryOption(c, c.label()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CrmDocumentResponse getById(User actor, Long id) {
        return toResponse(findAccessibleDocument(actor, id), actor);
    }

    @Transactional(readOnly = true)
    public DownloadPayload download(User actor, Long id) {
        CrmDocument document = findAccessibleDocument(actor, id);
        StoredFileContent content = load(document);
        return new DownloadPayload(content, document.getOriginalFilename(), document.getMimeType());
    }

    /** Preview is inline only for application/pdf and image/*; every other mime type falls back to
     *  a plain attachment download rather than a 422 - the task spec explicitly leaves this an
     *  implementation choice ("либо attachment, либо 422"). Attachment-fallback was chosen because
     *  this is a general document archive where most stored files (doc/xlsx/csv/...) are
     *  legitimate, everyday content - returning a 422 for them would make "preview" a dead-end for
     *  the majority of documents in the library, whereas silently degrading to attachment always
     *  gives the caller *something* usable. */
    @Transactional(readOnly = true)
    public PreviewPayload preview(User actor, Long id) {
        CrmDocument document = findAccessibleDocument(actor, id);
        StoredFileContent content = load(document);
        boolean inline = isPreviewable(document.getMimeType());
        return new PreviewPayload(content, document.getOriginalFilename(), document.getMimeType(), inline);
    }

    @Transactional
    public CrmDocumentResponse update(User actor, Long id, UpdateRequest request) {
        CrmDocument document = findAccessibleDocument(actor, id);
        assertCanModify(actor, document);
        if (request.version() == null) {
            throw new BadRequestException("Укажите version", "VERSION_REQUIRED");
        }
        if (request.version() != document.getVersion()) {
            throw new ConflictException("Документ был изменён другим пользователем", "VERSION_CONFLICT");
        }
        String oldValue = document.getTitle();
        // Partial update: only fields explicitly present in the request body overwrite the
        // existing value - omitted fields keep whatever is already stored. Chosen over full-
        // replace semantics because the task spec marks every field except `version` optional,
        // and a PATCH endpoint with full-replace semantics for "optional" fields would silently
        // null out data the caller never intended to touch.
        if (request.name() != null) document.setTitle(request.name());
        if (request.category() != null) document.setCategory(request.category());
        if (request.comment() != null) document.setComment(request.comment());
        if (request.documentDate() != null) document.setDocumentDate(request.documentDate());
        document = repository.save(document);
        // Module fix item 9: audit is written only after the mutation has actually succeeded
        // (repository.save above), never before - a failed update leaves no audit trail claiming
        // it happened.
        auditLogService.log("CrmDocument", document.getId(), null, actor, "UPDATED",
                oldValue, document.getTitle(), null);
        return toResponse(document, actor);
    }

    /** version is mandatory (module fix item 1): DELETE without a version can no longer silently
     *  bypass optimistic locking - see CrmDocumentController#archive. */
    @Transactional
    public CrmDocumentResponse archive(User actor, Long id, long version) {
        CrmDocument document = findAccessibleDocument(actor, id);
        if (!canDelete(actor, document)) {
            throw new CrmDocumentAccessDeniedException(
                    "Удалять документ может только загрузивший его сотрудник, ADMIN или DIRECTOR",
                    "DOCUMENT_DELETE_FORBIDDEN");
        }
        if (version != document.getVersion()) {
            throw new ConflictException("Документ был изменён другим пользователем", "VERSION_CONFLICT");
        }
        document.setArchived(true);
        document.setArchivedAt(LocalDateTime.now());
        document.setArchivedByUserId(actor.getId());
        document = repository.save(document);
        auditLogService.log("CrmDocument", document.getId(), null, actor, "ARCHIVED",
                null, null, null);
        return toResponse(document, actor);
    }

    /** Module fix item 3/4: single access-checked lookup used by detail/download/preview/update/
     *  archive alike - a non-archived document is visible to any staff role with DOCUMENT_VIEW
     *  (the class-level @PreAuthorize already enforced that); an ARCHIVED document is only
     *  resolvable by its uploader or an elevated role (ADMIN/DIRECTOR - module fix item 5, same
     *  set {@link #canDelete} already used), never by an arbitrary employee guessing/enumerating
     *  ids - reported as 404 (not 403) so an archived document's existence isn't leaked either. */
    private CrmDocument findAccessibleDocument(User actor, Long id) {
        CrmDocument document = find(id);
        if (document.isArchived() && !canDelete(actor, document)) {
            throw new NotFoundException("Документ не найден", "CRM_DOCUMENT_NOT_FOUND");
        }
        return document;
    }

    /** Specification.and(null) throws IllegalArgumentException in this Spring Data version (unlike
     *  Specification.where(null), which tolerates it) - each optional filter is combined this way
     *  instead so an absent filter param is simply skipped. */
    private static Specification<CrmDocument> andIfPresent(Specification<CrmDocument> spec, Specification<CrmDocument> maybeNull) {
        return maybeNull == null ? spec : spec.and(maybeNull);
    }

    private CrmDocument find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Документ не найден", "CRM_DOCUMENT_NOT_FOUND"));
    }

    private StoredFileContent load(CrmDocument document) {
        try {
            return fileStorageService.load(document.getFileId());
        } catch (IOException e) {
            throw new CrmDocumentStorageException("Не удалось загрузить файл", e);
        }
    }

    private void assertCanModify(User actor, CrmDocument document) {
        if (!canDelete(actor, document)) {
            throw new CrmDocumentAccessDeniedException(
                    "Редактировать или архивировать документ может только загрузивший его сотрудник, ADMIN или DIRECTOR");
        }
    }

    /** Same ownership rule for edit and delete: uploader, or ADMIN/DIRECTOR. Named canDelete since
     *  that's the boolean the /api/staff/documents response contract exposes per-document. */
    private boolean canDelete(User actor, CrmDocument document) {
        boolean isOwner = document.getUploadedByUserId() != null && document.getUploadedByUserId().equals(actor.getId());
        boolean isElevated = ELEVATED_ROLES.contains(actor.getRole());
        return isOwner || isElevated;
    }

    private static boolean isPreviewable(String mimeType) {
        if (mimeType == null) return false;
        String normalized = mimeType.toLowerCase();
        return PREVIEWABLE_MIME_PREFIXES_EXACT.contains(normalized) || normalized.startsWith("image/");
    }

    private CrmDocumentResponse toResponse(CrmDocument document, User actor) {
        User uploader = userRepository.findById(document.getUploadedByUserId()).orElse(null);
        UploadedByResponse uploadedBy = uploader == null ? null
                : new UploadedByResponse(uploader.getId(), uploader.getName());
        boolean canDelete = canDelete(actor, document) && !document.isArchived();
        return new CrmDocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getCategory(),
                document.getComment(),
                document.getOriginalFilename(),
                document.getMimeType(),
                document.getFileSize(),
                toIsoUtc(document.getCreatedAt()),
                uploadedBy,
                "/api/staff/documents/" + document.getId() + "/download",
                canDelete,
                availableActions(document, canDelete),
                document.getVersion()
        );
    }

    /** No explicit timezone column is stored (createdAt is a plain LocalDateTime), but every
     *  LocalDateTime.now() call in this service (and the rest of the app) runs against the
     *  server's clock, which is provisioned in UTC - module fix item 7: converted via a real
     *  OffsetDateTime/Instant instead of string-concatenating a "Z" onto whatever
     *  LocalDateTime#toString() happens to produce (which silently mis-formats when the value has
     *  zero sub-second precision, e.g. "...:00" vs "...:00.000"). */
    private static String toIsoUtc(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.atOffset(java.time.ZoneOffset.UTC).toInstant().toString();
    }

    /** DOWNLOAD: any staff role, non-archived document (archived documents aren't reachable through
     *  the default list - see notArchived() - but direct-by-id access still resolves so an owner/
     *  admin can look up something they just deleted). DELETE: uploader or ADMIN/DIRECTOR only,
     *  already computed as canDelete. */
    private List<String> availableActions(CrmDocument document, boolean canDelete) {
        List<String> actions = new ArrayList<>();
        actions.add("DOWNLOAD");
        if (canDelete) {
            actions.add("DELETE");
        }
        return actions;
    }

    public record DownloadPayload(StoredFileContent content, String filename, String mimeType) {}

    public record PreviewPayload(StoredFileContent content, String filename, String mimeType, boolean inline) {}
}
