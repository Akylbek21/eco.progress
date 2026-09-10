package kz.eco.signaturedoc.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class SignatureDocumentApiDtos {

    private SignatureDocumentApiDtos() {
    }

    public record UploadRequest(String title, String description) {
    }

    public record DocumentResponse(
            Long id, Long createdByUserId, String title, String description,
            String originalFileName, String mimeType, long fileSize, String sha256,
            String status, long version, LocalDateTime createdAt, LocalDateTime updatedAt,
            LocalDateTime signedAt) {
    }

    public record DocumentListResponse(List<DocumentResponse> items, long totalElements, int totalPages,
                                        int page, int size) {
    }

    public record PrepareSigningResponse(
            String signingSessionId, Long documentId, long version, String sha256,
            String contentUrl, String signatureFormat, LocalDateTime expiresAt) {
    }

    /** tsaTimestampBase64 is optional (module spec item 5: "TSA/timestamp, если используется") -
     *  a Base64-encoded RFC 3161 TimeStampToken over the same signed content, if the client's
     *  signing tool produced one. */
    public record SubmitSignatureRequest(
            String signingSessionId, Long documentId, long version, String sha256, String cmsBase64,
            String tsaTimestampBase64) {
    }

    public record SignatureResponse(
            Long id, Long documentId, int documentVersion, Long signerUserId,
            String certificateSerialNumber, String certificateSubject, String certificateIssuer,
            String certificateIin, String certificateBin, String certificateValidFrom,
            String certificateValidTo, String signatureAlgorithm, String verificationStatus,
            String verificationMessage, LocalDateTime signedAt) {
    }

}
