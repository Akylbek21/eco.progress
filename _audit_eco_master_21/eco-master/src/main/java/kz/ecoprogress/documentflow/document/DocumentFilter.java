package kz.ecoprogress.documentflow.document;

import java.time.LocalDate;

/**
 * Every filter GET /api/document-flow/documents accepts. signerId/requiresMySignature reference
 * signing-assignment data owned by Agent C's branch (document_flow_signing_assignments) which
 * does not exist yet in this worktree.
 * TODO-RECONCILE: once that table lands, wire signerId/requiresMySignature into
 * DocumentSpecifications as a real join/exists-subquery instead of being accepted-but-ignored.
 */
public record DocumentFilter(
        DocumentDirection direction,
        DocumentType type,
        DocumentStatus status,
        Long counterpartyId,
        Long authorId,
        Long signerId,
        Boolean requiresMySignature,
        Boolean overdue,
        LocalDate createdFrom,
        LocalDate createdTo,
        LocalDate deadlineFrom,
        LocalDate deadlineTo,
        String query
) {
}
