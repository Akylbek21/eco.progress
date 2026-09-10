package kz.eco.content.dto;

public record CreateExpertRequest(
        String fullName,
        String position,
        String specializations,
        Integer experienceYears,
        String credentials,
        String bio,
        String photoUrl,
        String profileUrl
) {
}
