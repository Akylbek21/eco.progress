package kz.eco.documentlibrary;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.CategoryOption;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.CrmDocumentResponse;
import kz.eco.documentlibrary.dto.CrmDocumentApiDtos.UpdateRequest;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.SecurityExpressions;
import kz.eco.user.User;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/** General CRM document archive - deliberately unrelated to orders/protocols/PEK/document-flow;
 *  see kz.eco.documentlibrary.CrmDocument javadoc. Base path /api/staff/documents. */
@RestController
@RequestMapping("/api/staff/documents")
public class CrmDocumentController {

    private final CrmDocumentService service;

    public CrmDocumentController(CrmDocumentService service) {
        this.service = service;
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_VIEW)
    @GetMapping
    public ApiResponse<PageResponse<CrmDocumentResponse>> list(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "uploadedByUserId", required = false) Long uploadedByUserId,
            @RequestParam(value = "dateFrom", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(value = "dateTo", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "sort", defaultValue = "createdAt,desc") String sort) {
        User actor = CurrentUser.get();
        Pageable pageable = PageRequest.of(page, Math.min(Math.max(size, 1), 100), parseSort(sort));
        return ApiResponse.ok(service.search(actor, q, category, uploadedByUserId, dateFrom, dateTo, pageable));
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_VIEW)
    @GetMapping("/categories")
    public ApiResponse<List<CategoryOption>> categories() {
        return ApiResponse.ok(service.categories());
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_VIEW)
    @GetMapping("/{id}")
    public ApiResponse<CrmDocumentResponse> get(@PathVariable Long id) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.getById(actor, id));
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_UPLOAD)
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CrmDocumentResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("category") String category,
            @RequestParam(value = "comment", required = false) String comment,
            @RequestParam(value = "documentDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate documentDate) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.upload(actor, file, name, category, comment, documentDate), "Документ загружен");
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_UPLOAD)
    @PatchMapping("/{id}")
    public ApiResponse<CrmDocumentResponse> update(@PathVariable Long id, @RequestBody UpdateRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.update(actor, id, request), "Документ обновлён");
    }

    /** version is mandatory (module fix item 1): DELETE without a version can no longer silently
     *  bypass optimistic locking. Returns {@code {success:true,data:null}} per the contract's
     *  standard-envelope alternative to a bare 204. */
    @PreAuthorize(SecurityExpressions.DOCUMENT_DELETE)
    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@PathVariable Long id, @RequestParam("version") long version) {
        User actor = CurrentUser.get();
        service.archive(actor, id, version);
        return ApiResponse.ok(null, "Документ удалён");
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_DOWNLOAD)
    @GetMapping("/{id}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable Long id) {
        User actor = CurrentUser.get();
        CrmDocumentService.DownloadPayload payload = service.download(actor, id);
        StoredFileContent content = payload.content();
        return ResponseEntity.ok()
                .contentType(mediaType(payload.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(payload.filename(), true))
                .body(new InputStreamResource(content.inputStream()));
    }

    @PreAuthorize(SecurityExpressions.DOCUMENT_DOWNLOAD)
    @GetMapping("/{id}/preview")
    public ResponseEntity<InputStreamResource> preview(@PathVariable Long id) {
        User actor = CurrentUser.get();
        CrmDocumentService.PreviewPayload payload = service.preview(actor, id);
        StoredFileContent content = payload.content();
        return ResponseEntity.ok()
                .contentType(mediaType(payload.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(payload.filename(), !payload.inline()))
                .body(new InputStreamResource(content.inputStream()));
    }

    private static MediaType mediaType(String mimeType) {
        try {
            return MediaType.parseMediaType(mimeType);
        } catch (Exception e) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    /** Emits both the legacy ASCII `filename=` (for older clients that ignore `filename*=`) and the
     *  RFC 5987 `filename*=UTF-8''...` extended parameter (for correct Cyrillic/Unicode names). */
    private static String contentDisposition(String filename, boolean attachment) {
        String asciiFallback = filename.replaceAll("[^\\x20-\\x7E]", "_").replace("\"", "'");
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        String disposition = attachment ? "attachment" : "inline";
        return disposition + "; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded;
    }

    /** Maps frontend sort-property names to actual CrmDocument entity property names - the
     *  frontend sends {@code uploadedAt}/{@code name} (its own field naming), but the entity
     *  columns are {@code createdAt}/{@code title}. Passing an unknown property straight into
     *  {@link Sort#by} would blow up in the persistence layer, so any property not in this map
     *  falls back to {@code createdAt} rather than failing the request. */
    private static final java.util.Map<String, String> SORT_PROPERTY_ALIASES = java.util.Map.of(
            "uploadedAt", "createdAt",
            "createdAt", "createdAt",
            "name", "title",
            "title", "title"
    );

    private static Sort parseSort(String sort) {
        String[] parts = sort.split(",");
        String requested = parts.length > 0 && !parts[0].isBlank() ? parts[0].trim() : "createdAt";
        String property = SORT_PROPERTY_ALIASES.getOrDefault(requested, "createdAt");
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim())
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, property);
    }
}
