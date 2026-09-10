package kz.ecoprogress.documentflow.signing.dto;

/**
 * GET /api/public/document-flow/signing/{token}/challenge (module spec §13) - everything the
 * external signer's client needs to build/verify a CMS signature, without exposing
 * assignmentId/versionId (those stay server-side, resolved from the token, exactly like every
 * other public endpoint in this controller - see PublicSigningService.resolveAssignment).
 *
 * {@code dataToSign} documents the actual contract this module verifies against
 * (CmsDocumentVerificationService.verify(cms, documentBytes, sha256Hash)): the signer's NCALayer
 * client signs the raw document bytes themselves (fetched from GET .../file) - {@code sha256}
 * here is for the client to confirm it fetched the exact bytes being signed, not a separate
 * hash-only signing payload. {@code algorithm} names the hash algorithm used for that
 * verification (SHA-256), not a signature algorithm the client must pick.
 */
public record PublicSigningChallengeDto(
        String documentTitle,
        String documentNumber,
        String signerRole,
        String fileName,
        String mimeType,
        long fileSize,
        String sha256,
        String dataToSign,
        String algorithm,
        String invitationExpiresAt,
        String signingDeadline
) {
}
