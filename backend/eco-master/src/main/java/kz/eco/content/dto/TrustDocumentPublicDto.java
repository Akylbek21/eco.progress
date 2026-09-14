package kz.eco.content.dto;

import kz.eco.content.TrustDocument;

import java.time.LocalDate;

/** Public CMS contract for trust documents. Excludes admin-only fields (verificationStatus,
 *  version, verifierId, verifiedAt) - those belong to TrustDocumentDto used by the admin API. */
public record TrustDocumentPublicDto(
        Long id,
        String documentType,
        String documentNumber,
        String issuedBy,
        LocalDate issuedAt,
        LocalDate validUntil,
        String sourceUrl
) {
    public static TrustDocumentPublicDto from(TrustDocument d) {
        return new TrustDocumentPublicDto(d.getId(), d.getDocumentType(), d.getDocumentNumber(),
                d.getIssuedBy(), d.getIssuedAt(), d.getValidUntil(), d.getSourceUrl());
    }
}
