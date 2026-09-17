package kz.eco.content.dto;

import java.time.LocalDate;

public record CreateTrustDocumentRequest(
        String documentType,
        String documentNumber,
        String issuedBy,
        LocalDate issuedAt,
        LocalDate validUntil,
        String sourceUrl
) {
}
