package kz.eco.content.dto;

import kz.eco.content.Expert;

import java.time.Instant;

public record ExpertDto(
        Long id,
        String fullName,
        String position,
        String credentials,
        String bio,
        String photoUrl,
        String verificationStatus,
        Instant verifiedAt,
        Long version
) {
    public static ExpertDto from(Expert e) {
        return new ExpertDto(e.getId(), e.getFullName(), e.getPosition(), e.getCredentials(), e.getBio(),
                e.getPhotoUrl(), e.getVerificationStatus().name(), e.getVerifiedAt(), e.getVersion());
    }
}
