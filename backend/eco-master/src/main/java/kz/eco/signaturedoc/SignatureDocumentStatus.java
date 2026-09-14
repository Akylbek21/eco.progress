package kz.eco.signaturedoc;

import java.util.Map;
import java.util.Set;

/**
 * Lifecycle of a self-service signature document, simplified to just DRAFT/SIGNED (module spec:
 * "Статусы: DRAFT, SIGNED. AWAITING_SIGNATURE использовать только во время подписания") -
 * AWAITING_SIGNATURE is a transient in-flight state used only between prepare-signing and
 * submitSignature, never a status a document is left parked in on its own. ARCHIVED/
 * SIGNATURE_FAILED (and the archive endpoint) have been removed entirely - not part of the kept
 * endpoint surface.
 */
public enum SignatureDocumentStatus {
    DRAFT,
    AWAITING_SIGNATURE,
    SIGNED;

    private static final Map<SignatureDocumentStatus, Set<SignatureDocumentStatus>> ALLOWED_TRANSITIONS = Map.of(
            DRAFT, Set.of(AWAITING_SIGNATURE),
            AWAITING_SIGNATURE, Set.of(AWAITING_SIGNATURE, SIGNED, DRAFT),
            SIGNED, Set.of()
    );

    public boolean canTransitionTo(SignatureDocumentStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }
}
