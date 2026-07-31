package kz.ecoprogress.documentflow.document;

import java.util.Map;
import java.util.Set;

/**
 * Lifecycle of a document_flow_documents row. Mirrors the pattern in
 * kz.eco.protocol.ProtocolStatus: a canonical allow-list of transitions plus an "editable" set,
 * both queried through methods rather than re-derived ad hoc at call sites. This module only
 * implements the DRAFT-only CRUD paths itself - SENT_FOR_SIGNING/PARTIALLY_SIGNED/SIGNED
 * transitions are driven by Agent C's signing routes calling
 * {@code DocumentService.transitionStatus(...)}, but the allow-list lives here so both sides of
 * that boundary share one source of truth.
 */
public enum DocumentStatus {
    DRAFT,
    READY_FOR_SIGNING,
    SENT_FOR_SIGNING,
    PARTIALLY_SIGNED,
    SIGNED,
    REJECTED,
    RETURNED_FOR_REVISION,
    REVOCATION_REQUESTED,
    REVOKED,
    CANCELLED,
    EXPIRED,
    ARCHIVED;

    private static final Map<DocumentStatus, Set<DocumentStatus>> ALLOWED_TRANSITIONS = Map.ofEntries(
            // SENT_FOR_SIGNING is reachable directly from DRAFT: nothing in this module ever
            // persists a document as READY_FOR_SIGNING (SigningRouteService.prepareForSigning
            // accepts either DRAFT or READY_FOR_SIGNING as its starting point but doesn't itself
            // transition to READY_FOR_SIGNING - sendForSigning goes straight from whatever DRAFT/
            // READY_FOR_SIGNING state it found to SENT_FOR_SIGNING).
            Map.entry(DRAFT, Set.of(READY_FOR_SIGNING, SENT_FOR_SIGNING, CANCELLED, ARCHIVED)),
            Map.entry(READY_FOR_SIGNING, Set.of(SENT_FOR_SIGNING, DRAFT, CANCELLED)),
            Map.entry(SENT_FOR_SIGNING, Set.of(PARTIALLY_SIGNED, SIGNED, REJECTED,
                    RETURNED_FOR_REVISION, EXPIRED, CANCELLED)),
            Map.entry(PARTIALLY_SIGNED, Set.of(SIGNED, REJECTED, RETURNED_FOR_REVISION, EXPIRED, CANCELLED)),
            Map.entry(SIGNED, Set.of(REVOCATION_REQUESTED, ARCHIVED)),
            Map.entry(REJECTED, Set.of(DRAFT, ARCHIVED, CANCELLED)),
            Map.entry(RETURNED_FOR_REVISION, Set.of(DRAFT, READY_FOR_SIGNING, CANCELLED)),
            Map.entry(REVOCATION_REQUESTED, Set.of(REVOKED, SIGNED)),
            Map.entry(REVOKED, Set.of(ARCHIVED)),
            Map.entry(CANCELLED, Set.of(ARCHIVED)),
            Map.entry(EXPIRED, Set.of(ARCHIVED, DRAFT)),
            Map.entry(ARCHIVED, Set.of())
    );

    /** Statuses whose fields/attachments/current-version may still be edited or replaced -
     *  everything else is frozen (mirrors ProtocolStatus.EDITABLE). Only DRAFT for this module,
     *  since RETURNED_FOR_REVISION documents must go back to DRAFT (an explicit transition) before
     *  they can be edited again - unlike protocols, there is no direct "edit while returned" path. */
    private static final Set<DocumentStatus> EDITABLE = Set.of(DRAFT);

    public boolean canTransitionTo(DocumentStatus target) {
        return ALLOWED_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }

    public boolean isEditable() {
        return EDITABLE.contains(this);
    }
}
