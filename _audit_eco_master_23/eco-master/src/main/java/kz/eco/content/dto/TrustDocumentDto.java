package kz.eco.content.dto;

import kz.eco.content.TrustDocument;

import java.time.Instant;
import java.time.LocalDate;

public record TrustDocumentDto(
        Long id,
        String documentType,
        String documentNumber,
        String issuedBy,
        LocalDate issuedAt,
        LocalDate validUntil,
        String verificationStatus,
        Instant verifiedAt,
        String sourceUrl,
        Long version
) {
    public static TrustDocumentDto from(TrustDocument d) {
        return new TrustDocumentDto(d.getId(), d.getDocumentType(), d.getDocumentNumber(), d.getIssuedBy(),
                d.getIssuedAt(), d.getValidUntil(), d.getVerificationStatus().name(), d.getVerifiedAt(),
                d.getSourceUrl(), d.getVersion());
    }
}
