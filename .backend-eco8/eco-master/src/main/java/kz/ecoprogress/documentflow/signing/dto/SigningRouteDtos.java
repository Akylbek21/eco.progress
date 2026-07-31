package kz.ecoprogress.documentflow.signing.dto;

import java.time.Instant;
import java.util.List;

public final class SigningRouteDtos {

    private SigningRouteDtos() {
    }

    public record CreateAssignmentRequest(
            String signerType,
            Long userId,
            String signerFullName,
            String signerIin,
            String organizationName,
            String organizationBin,
            String email,
            String phone,
            String roleCode,
            Boolean required
    ) {
    }

    public record CreateStepRequest(
            Integer requiredCount,
            List<CreateAssignmentRequest> assignments
    ) {
    }

    public record CreateSigningRouteRequest(
            String routeType,
            List<CreateStepRequest> steps
    ) {
    }

    public record AssignmentResponse(
            Long id,
            Long stepId,
            String signerType,
            Long userId,
            String signerFullName,
            String organizationName,
            String organizationBin,
            String email,
            String phone,
            String roleCode,
            boolean required,
            String status,
            Instant availableAt,
            Instant viewedAt,
            Instant signedAt,
            Instant rejectedAt,
            String rejectionReason,
            Instant invitationExpiresAt
    ) {
    }

    public record StepResponse(
            Long id,
            int stepOrder,
            int requiredCount,
            List<AssignmentResponse> assignments
    ) {
    }

    public record SigningRouteResponse(
            Long id,
            Long documentId,
            String routeType,
            String status,
            Long createdBy,
            Instant createdAt,
            Instant activatedAt,
            Instant completedAt,
            Long version,
            List<StepResponse> steps
    ) {
    }

    public record SubmitSignatureRequest(
            Long documentId,
            Long versionId,
            Long assignmentId,
            String cms,
            String clientRequestId,
            // Deliberately present so a client that sends any of these gets a clear, explicit
            // rejection (PRIVATE_KEY_MATERIAL_NOT_ALLOWED) instead of the field being silently
            // ignored - this endpoint must NEVER accept private key material.
            String privateKey,
            String password,
            String pkcs12
    ) {
    }

    public record SignatureResponse(
            Long id,
            Long documentId,
            Long documentVersionId,
            Long routeId,
            Long assignmentId,
            Long signerUserId,
            String certificateSerialNumber,
            String certificateSubject,
            String certificateIssuer,
            String certificateBin,
            String certificateValidFrom,
            String certificateValidTo,
            Instant signedAt,
            String verificationStatus
    ) {
    }

    public record PrepareForSigningRequest(
            Long expectedVersion
    ) {
    }

    public record RejectRequest(
            String reason
    ) {
    }
}
