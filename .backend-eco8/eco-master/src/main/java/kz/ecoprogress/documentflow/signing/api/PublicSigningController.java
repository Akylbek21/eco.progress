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

    @GetMapping(value = "/{token}/file", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<byte[]> file(@PathVariable String token) {
        byte[] bytes = service.getDocumentBytes(token);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"document.bin\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    @PostMapping("/{token}/viewed")
    public ApiResponse<Void> viewed(@PathVariable String token) {
        service.markViewed(token);
        return ApiResponse.message("OK");
    }

    @PostMapping("/{token}/sign")
    public ApiResponse<SigningRouteDtos.SignatureResponse> sign(
            @PathVariable String token, @RequestBody SigningRouteDtos.SubmitSignatureRequest request) {
        DocumentFlowSignature signature = service.sign(token, request);
        return ApiResponse.ok(mapper.toResponse(signature));
    }

    @PostMapping("/{token}/reject")
    public ApiResponse<Void> reject(@PathVariable String token, @RequestBody SigningRouteDtos.RejectRequest request) {
        service.reject(token, request.reason());
        return ApiResponse.message("Отклонено");
    }
}
