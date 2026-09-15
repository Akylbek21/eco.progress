package kz.eco.content.dto;

import java.time.LocalDate;
import java.util.List;

/** PUT body - version is mandatory (optimistic locking, see kz.eco.content.ContentVersioning); a
 *  stale value returns 409 VERSION_CONFLICT so two editors can never silently overwrite each
 *  other. Field edits are only permitted while the case is DRAFT or has been returned to DRAFT -
 *  see CaseStudyService#update. */
public record UpdateCaseStudyRequest(
        String title,
        String summary,
        String clientLabel,
        String serviceId,
        String citySlug,
        String industry,
        String objectType,
        String challenge,
        String solution,
        List<String> results,
        String image,
        LocalDate publishedAt,
        Long version
) {
}
