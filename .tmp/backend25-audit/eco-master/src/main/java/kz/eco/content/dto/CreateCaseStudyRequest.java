package kz.eco.content.dto;

import java.time.LocalDate;
import java.util.List;

public record CreateCaseStudyRequest(
        String id,
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
        LocalDate publishedAt
) {
}
