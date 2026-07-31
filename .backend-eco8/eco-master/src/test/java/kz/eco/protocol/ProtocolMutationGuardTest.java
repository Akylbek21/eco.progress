package kz.eco.protocol;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Pure unit coverage (no Spring context) of the module's central mutability policy - module spec
 *  §5. Deliberately exercises both policy tiers (EDITABLE_ONLY vs generation-only actions) since
 *  the whole point of the guard is that they are NOT the same predicate. */
class ProtocolMutationGuardTest {

    private final ProtocolMutationGuard guard = new ProtocolMutationGuard();

    private static Protocol withStatus(ProtocolStatus status) {
        Protocol protocol = new Protocol();
        protocol.setId(46L);
        protocol.setStatus(status);
        return protocol;
    }

    @Test
    void editableOnlyAction_allowedInDraftCalculatedReadyNeedsRevision() {
        for (ProtocolStatus status : new ProtocolStatus[]{
                ProtocolStatus.DRAFT, ProtocolStatus.CALCULATED, ProtocolStatus.READY, ProtocolStatus.NEEDS_REVISION}) {
            assertDoesNotThrow(() -> guard.requireEditable(withStatus(status), ProtocolMutationAction.UPDATE_HEADER),
                    status + " should allow UPDATE_HEADER");
        }
    }

    @Test
    void editableOnlyAction_blockedOnceReadyForApprovalOrLater() {
        for (ProtocolStatus status : new ProtocolStatus[]{
                ProtocolStatus.READY_FOR_APPROVAL, ProtocolStatus.APPROVED, ProtocolStatus.SIGNED,
                ProtocolStatus.REPLACED, ProtocolStatus.CANCELLED, ProtocolStatus.ARCHIVED}) {
            ProtocolImmutableException ex = assertThrows(ProtocolImmutableException.class,
                    () -> guard.requireEditable(withStatus(status), ProtocolMutationAction.CALCULATE),
                    status + " must block CALCULATE");
            assertEquals(status.name(), ex.getDetails().get("status"));
            assertEquals("CALCULATE", ex.getDetails().get("action"));
            assertEquals("46", ex.getDetails().get("protocolId"));
        }
    }

    /** The whole reason this guard has two tiers instead of one: document generation legitimately
     *  runs on READY_FOR_APPROVAL/APPROVED protocols (approve()/sign() call it to produce the PDF
     *  that then gets signed), even though those statuses are NOT "editable". */
    @Test
    void generationAction_allowedOnReadyForApprovalAndApproved_unlikeEditableOnlyActions() {
        assertDoesNotThrow(() -> guard.requireEditable(withStatus(ProtocolStatus.READY_FOR_APPROVAL), ProtocolMutationAction.GENERATE_PDF));
        assertDoesNotThrow(() -> guard.requireEditable(withStatus(ProtocolStatus.APPROVED), ProtocolMutationAction.GENERATE_DOCX));
    }

    /** The fix under test: once actually SIGNED (or any later terminal state derived from it),
     *  document generation must never run again - this is the exact hole the audit found
     *  (ProtocolDocumentGenerationService had the guard injected but never called it). */
    @Test
    void generationAction_blockedOnceSignedOrLater() {
        for (ProtocolStatus status : new ProtocolStatus[]{
                ProtocolStatus.SIGNED, ProtocolStatus.REPLACED, ProtocolStatus.CANCELLED, ProtocolStatus.ARCHIVED}) {
            ProtocolImmutableException ex = assertThrows(ProtocolImmutableException.class,
                    () -> guard.requireEditable(withStatus(status), ProtocolMutationAction.GENERATE_PDF),
                    status + " must block GENERATE_PDF");
            assertEquals("GENERATE_PDF", ex.getDetails().get("action"));

            assertThrows(ProtocolImmutableException.class,
                    () -> guard.requireEditable(withStatus(status), ProtocolMutationAction.GENERATE_DOCX),
                    status + " must block GENERATE_DOCX");
        }
    }

    @Test
    void softDeletedProtocol_blocksEveryAction_regardlessOfStatus() {
        Protocol protocol = withStatus(ProtocolStatus.DRAFT);
        protocol.setDeletedAt(LocalDateTime.now());

        assertThrows(ProtocolImmutableException.class,
                () -> guard.requireEditable(protocol, ProtocolMutationAction.UPDATE_HEADER));
        assertThrows(ProtocolImmutableException.class,
                () -> guard.requireEditable(protocol, ProtocolMutationAction.GENERATE_PDF));
    }
}
