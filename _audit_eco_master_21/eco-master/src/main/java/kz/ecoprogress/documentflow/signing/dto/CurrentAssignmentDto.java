package kz.ecoprogress.documentflow.signing.dto;

import kz.ecoprogress.documentflow.signing.AssignmentStatus;

import java.time.LocalDateTime;

/** GET /api/document-flow/documents/{id}/my-assignment (module spec §10) - lets the frontend
 *  reliably discover the CURRENT user's own assignment on a document instead of scanning the full
 *  signing-route response and guessing which row is "mine". Never returns another user's
 *  assignment - see DocumentFlowSigningController#myAssignment. */
public record CurrentAssignmentDto(
        Long assignmentId,
        Long documentId,
        Long versionId,
        Long routeId,
        Long stepId,
        int stepOrder,
        AssignmentStatus status,
        boolean required,
        String signerRole,
        LocalDateTime deadline,
        boolean canSign,
        boolean canReject,
        boolean canReturn
) {
}
