package kz.ecoprogress.documentflow.document;

import kz.ecoprogress.documentflow.plan.FeatureCode;

import java.util.List;

/** One row of the document-type catalog - see {@link DocumentTypeRegistry}. */
public record DocumentTypeConfig(
        DocumentType type,
        String title,
        AllowedDirection allowedDirections,
        FeatureCode requiredFeature, // nullable: no extra feature gate beyond DOCUMENT_FLOW/DOCUMENT_CREATE
        List<String> allowedMimeTypes,
        long maxSizeBytes,
        boolean signingRequired,
        boolean counterpartyRequired,
        boolean active
) {
    public boolean allowsDirection(DocumentDirection direction) {
        return switch (allowedDirections) {
            case BOTH -> true;
            case IN -> direction == DocumentDirection.INCOMING || direction == DocumentDirection.INTERNAL;
            case OUT -> direction == DocumentDirection.OUTGOING || direction == DocumentDirection.INTERNAL;
        };
    }
}
