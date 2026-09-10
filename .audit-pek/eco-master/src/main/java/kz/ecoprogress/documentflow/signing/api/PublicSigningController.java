package kz.ecoprogress.documentflow.signing.api;

import kz.eco.common.ApiResponse;
import kz.ecoprogress.documentflow.signing.DocumentFlowSignature;
import kz.ecoprogress.documentflow.signing.SigningResponseMapper;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * External-signer public API - no JWT, resolved entirely by invitation token. Never returns full
 * document metadata or other signers' PII (see PublicSigningService.PublicInvitationView, a
 * deliberately minimal projection).
 */
@RestController
@RequestMapping("/api/public/document-flow/signing")
public class PublicSigningController {

    private final PublicSigningService service;
    private final SigningResponseMapper mapper;

    public PublicSigningController(PublicSigningService service, SigningResponseMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping("/{token}")
    public ApiResponse<PublicSigningService.PublicInvitationView> get(@PathVariable String token) {
        return ApiResponse.ok(service.getInvitationView(token));
    }

    /** Module spec §13: real filename/MIME/size/hash for what GET .../file actually serves,
     *  without exposing documentId/versionId/assignmentId - everything is resolved from the token. */
    @GetMapping("/{token}/challenge")
    public ApiResponse<kz.ecoprogress.documentflow.signing.dto.PublicSigningChallengeDto> challenge(@PathVariable String token) {
        return ApiResponse.ok(service.getChallenge(token));
    }

    /** Module spec §14: real filename/MIME/Content-Length, not always "document.bin"/
     *  octet-stream - the challenge endpoint above already exposes this same metadata so the two
     *  never disagree. */
    @GetMapping("/{token}/file")
    public ResponseEntity<byte[]> file(@PathVariable String token) {
        var challenge = service.getChallenge(token);
        byte[] bytes = service.getDocumentBytes(token);
        String filename = challenge.fileName() != null ? challenge.fileName() : "document.bin";
        MediaType mimeType = challenge.mimeType() != null
                ? MediaType.parseMediaType(challenge.mimeType()) : MediaType.APPLICATION_OCTET_STREAM;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename*=UTF-8''"
                        + java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8))
                .contentType(mimeType)
                .contentLength(bytes.length)
                .body(bytes);
    }

    @PostMapping("/{token}/viewed")
    public ApiResponse<Void> viewed(@PathVariable String token) {
        service.markViewed(token);
        return ApiResponse.message("OK");
    }

    /** Module spec §13: body is {cms, clientRequestId} only - documentId/versionId/assignmentId
     *  are never accepted from the client here, resolved entirely from the token server-side. */
    @PostMapping("/{token}/sign")
    public ApiResponse<SigningRouteDtos.SignatureResponse> sign(
            @PathVariable String token, @RequestBody SigningRouteDtos.PublicSubmitSignatureRequest request) {
        DocumentFlowSignature signature = service.signByToken(token, request.cms(), request.clientRequestId());
        return ApiResponse.ok(mapper.toResponse(signature));
    }

    @PostMapping("/{token}/reject")
    public ApiResponse<Void> reject(@PathVariable String token, @RequestBody SigningRouteDtos.RejectRequest request) {
        service.reject(token, request.reason());
        return ApiResponse.message("Отклонено");
    }
}
