package kz.eco.documentlibrary;

import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import kz.eco.user.User;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;

/** Spring Data JPA Specification builders for {@link CrmDocument} search filters - one method per
 *  filter, combined via {@code Specification.where(...).and(...)} in {@link CrmDocumentService}
 *  rather than one hand-built JPQL query per filter combination. */
final class CrmDocumentSpecifications {

    private CrmDocumentSpecifications() {
    }

    static Specification<CrmDocument> notArchived() {
        return (root, query, cb) -> cb.isFalse(root.get("archived"));
    }

    static Specification<CrmDocument> category(String category) {
        if (category == null || category.isBlank()) return null;
        return (root, query, cb) -> cb.equal(cb.lower(root.get("category")), category.trim().toLowerCase());
    }

    static Specification<CrmDocument> uploadedByUserId(Long uploadedByUserId) {
        if (uploadedByUserId == null) return null;
        return (root, query, cb) -> cb.equal(root.get("uploadedByUserId"), uploadedByUserId);
    }

    static Specification<CrmDocument> dateFrom(LocalDate dateFrom) {
        if (dateFrom == null) return null;
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("documentDate"), dateFrom);
    }

    static Specification<CrmDocument> dateTo(LocalDate dateTo) {
        if (dateTo == null) return null;
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("documentDate"), dateTo);
    }

    /** Case-insensitive substring match across title + originalFilename + comment + the uploader's
     *  own name/email (module fix item 8: the UI searches "by author" too, but CrmDocument only
     *  stores uploadedByUserId - a raw FK, no JPA relationship - so matching by name/email needs a
     *  correlated subquery against kz.eco.user.User rather than a joinable property path). */
    static Specification<CrmDocument> search(String q) {
        if (q == null || q.isBlank()) return null;
        String like = "%" + q.trim().toLowerCase() + "%";
        return (root, query, cb) -> {
            Predicate byTitle = cb.like(cb.lower(root.get("title")), like);
            Predicate byFilename = cb.like(cb.lower(root.get("originalFilename")), like);
            Predicate byComment = cb.like(cb.lower(cb.coalesce(root.get("comment"), "")), like);

            Subquery<Long> authorMatch = query.subquery(Long.class);
            var userRoot = authorMatch.from(User.class);
            authorMatch.select(userRoot.get("id"));
            authorMatch.where(cb.and(
                    cb.equal(userRoot.get("id"), root.get("uploadedByUserId")),
                    cb.or(
                            cb.like(cb.lower(cb.coalesce(userRoot.get("name"), "")), like),
                            cb.like(cb.lower(cb.coalesce(userRoot.get("email"), "")), like)
                    )
            ));
            Predicate byAuthor = cb.exists(authorMatch);

            return cb.or(byTitle, byFilename, byComment, byAuthor);
        };
    }
}
