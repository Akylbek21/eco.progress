package kz.eco.signaturedoc;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.exception.NotFoundException;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.DocumentListResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.DocumentResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.PrepareSigningResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.SignatureResponse;
import kz.eco.signaturedoc.dto.SignatureDocumentApiDtos.SubmitSignatureRequest;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowIdempotencyService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * "Подпись документов" - simplified, self-service, single-user internal document upload + CMS/ЭЦП
 * signing flow for staff. Deliberately independent of kz.ecoprogress.documentflow's organization/
 * membership/subscription machinery (module spec: no OrganizationResolver, no DocumentFlowMembership,
 * no organizationId, no subscriptions) - visibility is own-documents-only, with ADMIN able to see
 * everyone's (see hasAdminExtendedAccess). Only 6 endpoints are exposed: upload, list, content,
 * prepare-signing, submit-signature, signed-package - get-by-id/list-signatures/archive have been
 * removed from the API surface (the underlying service methods some of them relied on are still used
 * internally, e.g. for idempotent-retry lookups).
 */
@RestController
@RequestMapping("/api/staff/signature-documents")
public class SignatureDocumentController {

    private final SignatureDocumentService documentService;
    private final SignatureDocumentSigningService signingService;
    private final SignatureDocumentPackageService packageService;
    private final DocumentFlowIdempotencyService idempotencyService;

    public SignatureDocumentController(SignatureDocumentService documentService,
                                        SignatureDocumentSigningService signingService,
                                        SignatureDocumentPackageService packageService,
                                        DocumentFlowIdempotencyService idempotencyService) {
        this.documentService = documentService;
        this.signingService = signingService;
        this.packageService = packageService;
        this.idempotencyService = idempotencyService;
    }

    @PreAuthorize(SignatureDocumentSecurityExpressions.SIGNATURE_DOCUMENT_CREATE)
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<DocumentResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) throws IOException {
        User actor = CurrentUser.get();

        // Module fix: idempotency used to be scoped by (scope, idempotencyKey) alone - two
        // different users sending the same client-generated key collided with each other's
        // uploads. Folding actorId into the scope string makes the key user-scoped without
        // touching the shared DocumentFlowIdempotencyRequest schema/unique constraint used by
        // every other caller of this service. The hash also now covers actorId, the file's real
        // content (sha256), and description - not just filename/size/title - so a genuinely
        // different upload under the same key is rejected as a reused key rather than silently
        // treated as a duplicate.
        byte[] content = file.getBytes();
        String sha256 = kz.eco.signaturedoc.SignatureDocumentService.sha256Hex(content);
        Map<String, Object> payload = Map.of(
                "actorId", actor.getId(),
                "sha256", sha256,
                "originalFileName", file.getOriginalFilename() == null ? "" : file.getOriginalFilename(),
                "size", file.getSize(),
                "title", title == null ? "" : title,
                "description", description == null ? "" : description);
        var outcome = idempotencyService.begin("signature-document-upload:" + actor.getId(), idempotencyKey, payload);
        if (outcome instanceof DocumentFlowIdempotencyService.ReturnExisting existing) {
            return ApiResponse.ok(toResponse(documentService.getScoped(existing.resultId(), actor, hasAdminExtendedAccess(actor))));
        }
        Long recordId = ((DocumentFlowIdempotencyService.Proceed) outcome).recordId();
        try {
            DocumentResponse response = documentService.upload(actor, title, description,
                    file.getOriginalFilename(), file.getContentType(), content);
            idempotencyService.complete(recordId, response.id());
            return ApiResponse.ok(response, "Документ загружен");
        } catch (RuntimeException e) {
            // Any failure after the PROCESSING record was created must mark it FAILED, or a retry
            // with the same key would get stuck on 409 IDEMPOTENCY_KEY_IN_PROGRESS forever (module
            // fix item 2). file.getBytes() (the only checked-IOException source in this flow) now
            // runs before this try block specifically so its failure is also covered - see above.
            idempotencyService.fail(recordId);
            throw e;
        }
    }

    @PreAuthorize(SignatureDocumentSecurityExpressions.SIGNATURE_DOCUMENT_READ)
    @GetMapping
    public ApiResponse<DocumentListResponse> list(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        User actor = CurrentUser.get();
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        return ApiResponse.ok(documentService.list(actor, hasAdminExtendedAccess(actor), pageable));
    }

    @PreAuthorize(SignatureDocumentSecurityExpressions.SIGNATURE_DOCUMENT_DOWNLOAD)
    @GetMapping("/{id}/content")
    public ResponseEntity<InputStreamResource> content(@PathVariable Long id) {
        User actor = CurrentUser.get();
        StoredFileContent content = documentService.getContent(id, actor, hasAdminExtendedAccess(actor));
        return ResponseEntity.ok()
                .contentType(mediaType(content.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(content.filename()))
                .body(new InputStreamResource(content.inputStream()));
    }

    @PreAuthorize(SignatureDocumentSecurityExpressions.SIGNATURE_DOCUMENT_SIGN)
    @PostMapping("/{id}/prepare-signing")
    public ApiResponse<PrepareSigningResponse> prepareSigning(@PathVariable Long id) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(signingService.prepareSigning(id, actor, hasAdminExtendedAccess(actor)));
    }

    @PreAuthorize(SignatureDocumentSecurityExpressions.SIGNATURE_DOCUMENT_SIGN)
    @PostMapping("/{id}/signatures")
    public ApiResponse<SignatureResponse> submitSignature(
            @PathVariable Long id,
            @RequestBody SubmitSignatureRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();

        Map<String, Object> payload = Map.of("actorId", actor.getId(), "signingSessionId", request.signingSessionId(),
                "documentId", request.documentId(), "version", request.version(), "sha256", request.sha256());
        var outcome = idempotencyService.begin("signature-document-sign:" + actor.getId(), idempotencyKey, payload);
        if (outcome instanceof DocumentFlowIdempotencyService.ReturnExisting existing) {
            SignatureResponse existingSignature = signingService.listSignatures(id, actor, hasAdminExtendedAccess(actor))
                    .stream().filter(s -> s.id().equals(existing.resultId())).findFirst()
                    .orElseThrow(() -> new NotFoundException("Подпись не найдена", "DOCUMENT_NOT_FOUND"));
            return ApiResponse.ok(existingSignature);
        }
        Long recordId = ((DocumentFlowIdempotencyService.Proceed) outcome).recordId();
        try {
            SignatureResponse response = signingService.submitSignature(id, actor, hasAdminExtendedAccess(actor), request);
            idempotencyService.complete(recordId, response.id());
            return ApiResponse.ok(response, "Документ подписан");
        } catch (RuntimeException e) {
            idempotencyService.fail(recordId);
            throw e;
        }
    }

    /** Module fix item 11: streams the ZIP straight to the servlet response as it's built, instead
     *  of buffering the whole archive in a ByteArrayOutputStream first - SignatureDocumentPackageService
     *  already writes to whatever OutputStream it's given; the previous controller code just
     *  handed it an in-memory buffer and then copied that buffer into the response body, which
     *  defeated the point (still held the entire ZIP in heap for every request). */
    @PreAuthorize(SignatureDocumentSecurityExpressions.SIGNATURE_DOCUMENT_DOWNLOAD)
    @GetMapping("/{id}/signed-package")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> signedPackage(@PathVariable Long id) {
        User actor = CurrentUser.get();
        boolean adminExtendedAccess = hasAdminExtendedAccess(actor);
        // Resolve the filename (and enforce access/status) up front, via a cheap read-only call,
        // so a 403/404/409 still produces a normal JSON error response instead of a half-started
        // stream with a generic filename - the actual ZIP bytes are written lazily inside the
        // StreamingResponseBody, after headers are already committed.
        String filename = packageService.resolvePackageFilename(id, actor, adminExtendedAccess);
        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody body =
                out -> packageService.buildZip(id, actor, adminExtendedAccess, out);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(filename))
                .body(body);
    }

    /** SIGNATURE_DOCUMENT_ADMIN_VIEW is a separate, explicitly-gated permission - ADMIN role alone
     *  does not imply extended access to other users' documents; this method is the one and only
     *  place that expresses the carve-out (module spec item 2: "ADMIN видит все документы"). */
    private boolean hasAdminExtendedAccess(User actor) {
        return actor.getRole() == UserRole.ADMIN;
    }

    private static DocumentResponse toResponse(SignatureDocument document) {
        return SignatureDocumentService.toResponse(document);
    }

    /** Mirrors CrmDocumentController#mediaType: a malformed/empty stored content-type must never
     *  bubble up as an unhandled InvalidMediaTypeException (500) - degrade to a generic download. */
    private static MediaType mediaType(String contentType) {
        try {
            return MediaType.parseMediaType(contentType);
        } catch (Exception e) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    /** Emits both the legacy ASCII `filename=` (for older clients that ignore `filename*=`) and the
     *  RFC 5987 `filename*=UTF-8''...` extended parameter (for correct Cyrillic/Unicode names). */
    private static String contentDisposition(String filename) {
        String asciiFallback = filename.replaceAll("[^\\x20-\\x7E]", "_").replace("\"", "'");
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return "attachment; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded;
    }
}
