package kz.ecoprogress.documentflow.document;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentStatusTest {

    @Test
    void draft_canMoveToReadyForSigningSentForSigningCancelledOrArchived() {
        assertTrue(DocumentStatus.DRAFT.canTransitionTo(DocumentStatus.READY_FOR_SIGNING));
        // Reachable directly: SigningRouteService.sendForSigning goes straight from DRAFT to
        // SENT_FOR_SIGNING - nothing in this module ever persists a document as READY_FOR_SIGNING
        // as an intermediate state first.
        assertFalse(DocumentStatus.DRAFT.canTransitionTo(DocumentStatus.SENT_FOR_SIGNING));
        assertTrue(DocumentStatus.DRAFT.canTransitionTo(DocumentStatus.PREPARED_FOR_SIGNING));
        assertTrue(DocumentStatus.DRAFT.canTransitionTo(DocumentStatus.CANCELLED));
        assertTrue(DocumentStatus.DRAFT.canTransitionTo(DocumentStatus.ARCHIVED));
        assertFalse(DocumentStatus.DRAFT.canTransitionTo(DocumentStatus.SIGNED));
    }

    @Test
    void sentForSigning_canReachPartiallySignedOrSignedOrTerminal() {
        assertTrue(DocumentStatus.SENT_FOR_SIGNING.canTransitionTo(DocumentStatus.PARTIALLY_SIGNED));
        assertTrue(DocumentStatus.SENT_FOR_SIGNING.canTransitionTo(DocumentStatus.SIGNED));
        assertTrue(DocumentStatus.SENT_FOR_SIGNING.canTransitionTo(DocumentStatus.REJECTED));
        assertTrue(DocumentStatus.SENT_FOR_SIGNING.canTransitionTo(DocumentStatus.RETURNED_FOR_REVISION));
        assertTrue(DocumentStatus.SENT_FOR_SIGNING.canTransitionTo(DocumentStatus.EXPIRED));
        assertFalse(DocumentStatus.SENT_FOR_SIGNING.canTransitionTo(DocumentStatus.DRAFT));
    }

    @Test
    void partiallySigned_canReachSignedOrRejectedButNotBackToDraft() {
        assertTrue(DocumentStatus.PARTIALLY_SIGNED.canTransitionTo(DocumentStatus.SIGNED));
        assertFalse(DocumentStatus.PARTIALLY_SIGNED.canTransitionTo(DocumentStatus.DRAFT));
        assertFalse(DocumentStatus.PARTIALLY_SIGNED.canTransitionTo(DocumentStatus.READY_FOR_SIGNING));
    }

    @Test
    void signed_canOnlyRequestRevocationOrArchive() {
        assertTrue(DocumentStatus.SIGNED.canTransitionTo(DocumentStatus.REVOCATION_REQUESTED));
        assertTrue(DocumentStatus.SIGNED.canTransitionTo(DocumentStatus.ARCHIVED));
        assertFalse(DocumentStatus.SIGNED.canTransitionTo(DocumentStatus.DRAFT));
        assertFalse(DocumentStatus.SIGNED.canTransitionTo(DocumentStatus.SENT_FOR_SIGNING));
    }

    @Test
    void revocationRequested_canBeRevokedOrRevertToSigned() {
        assertTrue(DocumentStatus.REVOCATION_REQUESTED.canTransitionTo(DocumentStatus.REVOKED));
        assertTrue(DocumentStatus.REVOCATION_REQUESTED.canTransitionTo(DocumentStatus.SIGNED));
    }

    @Test
    void archived_isTerminal() {
        for (DocumentStatus status : DocumentStatus.values()) {
            assertFalse(DocumentStatus.ARCHIVED.canTransitionTo(status),
                    "ARCHIVED must not transition to " + status);
        }
    }

    @Test
    void onlyDraft_isEditable() {
        assertTrue(DocumentStatus.DRAFT.isEditable());
        for (DocumentStatus status : DocumentStatus.values()) {
            if (status != DocumentStatus.DRAFT) {
                assertFalse(status.isEditable(), status + " must not be editable");
            }
        }
    }
}
