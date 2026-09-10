package kz.ecoprogress.documentflow.revocation;

import java.time.Instant;

public final class RevocationDtos {

    private RevocationDtos() {
    }

    public record CreateRevocationRequest(String reason) {
    }

    public record ResolveRevocationRequest(String comment) {
    }

    public record RevocationResponse(
            Long id,
            Long documentId,
            Long requestedBy,
            String status,
            String reason,
            Instant createdAt,
            Instant updatedAt,
            Instant resolvedAt,
            Long resolvedBy,
            String resolutionComment
    ) {
        public static RevocationResponse from(RevocationRequest r) {
            return new RevocationResponse(r.getId(), r.getDocumentId(), r.getRequestedBy(), r.getStatus().name(),
                    r.getReason(), r.getCreatedAt(), r.getUpdatedAt(), r.getResolvedAt(), r.getResolvedBy(),
                    r.getResolutionComment());
        }
    }
}
