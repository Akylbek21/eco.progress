package kz.ecoprogress.documentflow.document;

import kz.ecoprogress.documentflow.signing.AssignmentStatus;
import kz.ecoprogress.documentflow.signing.SigningAssignment;
import kz.ecoprogress.documentflow.signing.SigningRoute;
import kz.ecoprogress.documentflow.signing.SigningRouteStatus;
import kz.ecoprogress.documentflow.signing.SigningStep;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/** Builds the dynamic WHERE clause for GET /api/document-flow/documents from a {@link DocumentFilter}. */
public final class DocumentSpecifications {

    private DocumentSpecifications() {
    }

    /** @param currentUserId the authenticated caller - module spec §7: {@code requiresMySignature}
     *  always means "assigned to ME", the client-supplied {@code signerId} is never trusted for
     *  this filter (it is intentionally not read here at all). */
    public static Specification<Document> forOrganization(Long organizationId, DocumentFilter filter, Long currentUserId) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("organizationId"), organizationId));

            if (filter.direction() != null) {
                predicates.add(cb.equal(root.get("direction"), filter.direction()));
            }
            if (filter.type() != null) {
                predicates.add(cb.equal(root.get("documentType"), filter.type()));
            }
            if (filter.status() != null) {
                predicates.add(cb.equal(root.get("status"), filter.status()));
            }
            if (filter.counterpartyId() != null) {
                predicates.add(cb.equal(root.get("counterpartyId"), filter.counterpartyId()));
            }
            if (filter.authorId() != null) {
                predicates.add(cb.equal(root.get("authorUserId"), filter.authorId()));
            }
            if (filter.createdFrom() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filter.createdFrom().atStartOfDay()));
            }
            if (filter.createdTo() != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), filter.createdTo().plusDays(1).atStartOfDay()));
            }
            if (filter.deadlineFrom() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("signingDeadline"), filter.deadlineFrom().atStartOfDay()));
            }
            if (filter.deadlineTo() != null) {
                predicates.add(cb.lessThan(root.get("signingDeadline"), filter.deadlineTo().plusDays(1).atStartOfDay()));
            }
            if (Boolean.TRUE.equals(filter.overdue())) {
                predicates.add(cb.lessThan(root.get("signingDeadline"), LocalDateTime.now()));
                predicates.add(root.get("status").in(
                        DocumentStatus.READY_FOR_SIGNING, DocumentStatus.SENT_FOR_SIGNING, DocumentStatus.PARTIALLY_SIGNED));
            }
            if (filter.query() != null && !filter.query().isBlank()) {
                String like = "%" + filter.query().trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("documentNumber"), "")), like)
                ));
            }
            // Module spec §7: requiresMySignature=true means "I currently have a live, actionable
            // assignment on this document's ACTIVE route" - an EXISTS correlated subquery, not a
            // load-everything-then-filter-in-memory approach (this runs as part of the same page
            // query, so it never touches rows outside the requested page).
            if (Boolean.TRUE.equals(filter.requiresMySignature()) && currentUserId != null) {
                jakarta.persistence.criteria.Subquery<Long> sq = query.subquery(Long.class);
                var saRoot = sq.from(SigningAssignment.class);
                var stepRoot = sq.from(SigningStep.class);
                var routeRoot = sq.from(SigningRoute.class);
                sq.select(saRoot.get("id"));
                sq.where(cb.and(
                        cb.equal(saRoot.get("stepId"), stepRoot.get("id")),
                        cb.equal(stepRoot.get("routeId"), routeRoot.get("id")),
                        cb.equal(routeRoot.get("documentId"), root.get("id")),
                        cb.equal(routeRoot.get("status"), SigningRouteStatus.ACTIVE),
                        cb.equal(saRoot.get("userId"), currentUserId),
                        saRoot.get("status").in(AssignmentStatus.AVAILABLE, AssignmentStatus.VIEWED)
                ));
                predicates.add(cb.exists(sq));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
