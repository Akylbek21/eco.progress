package kz.ecoprogress.documentflow.document;

import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/** Builds the dynamic WHERE clause for GET /api/document-flow/documents from a {@link DocumentFilter}. */
public final class DocumentSpecifications {

    private DocumentSpecifications() {
    }

    public static Specification<Document> forOrganization(Long organizationId, DocumentFilter filter) {
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
            // signerId / requiresMySignature: TODO-RECONCILE - see DocumentFilter javadoc. Accepted
            // as query params (no 400) but intentionally not filtered on yet.

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
