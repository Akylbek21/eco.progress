package kz.eco.content.dto;

import kz.eco.content.Expert;

import java.time.Instant;

/** Public CMS contract for experts (E-E-A-T / schema.org Person).
 *  Excludes admin-only fields (version, verifierId). verificationStatus is included so the
 *  frontend can assert "VERIFIED" before rendering the Person schema node — it will always be
 *  "VERIFIED" here since unverified experts are never served by the public API. */
public record ExpertPublicDto(
        Long id,
        String fullName,
        String position,
        String specializations,
        Integer experienceYears,
        String credentials,
        String bio,
        String photoUrl,
        String profileUrl,
        String verificationStatus,
        Instant verifiedAt
) {
    public static ExpertPublicDto from(Expert e) {
        return new ExpertPublicDto(
                e.getId(),
                e.getFullName(),
                e.getPosition(),
                e.getSpecializations(),
                e.getExperienceYears(),
                e.getCredentials(),
                e.getBio(),
                e.getPhotoUrl(),
                e.getProfileUrl(),
                e.getVerificationStatus().name(),
                e.getVerifiedAt()
        );
    }
}
