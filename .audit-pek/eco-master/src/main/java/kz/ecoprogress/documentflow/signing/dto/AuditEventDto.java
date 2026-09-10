package kz.ecoprogress.documentflow.signing.dto;

import java.time.Instant;

/** GET /api/document-flow/documents/{id}/audit (module spec §18) - a deliberately narrow,
 *  explicitly-whitelisted view of DocumentFlowAuditLog. The entity's own javadoc already commits
 *  to never storing full CMS/IIN/tokens, so nothing here needs redaction beyond not exposing
 *  internal ids the frontend has no use for - this exists as its own type (not the entity
 *  directly) so that guarantee stays true even if the entity gains a more sensitive field later. */
public record AuditEventDto(
        Long id,
        Instant createdAt,
        Long actorUserId,
        String actorName,
        String eventType,
        String description
) {
}
