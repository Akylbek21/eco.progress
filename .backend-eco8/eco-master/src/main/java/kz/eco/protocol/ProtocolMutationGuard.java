package kz.eco.protocol;

import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Single, centralized "is this protocol allowed to be mutated this way right now" check (module
 * spec §5) - replaces several narrower, inconsistent checks that used to be scattered across
 * {@link kz.eco.protocol.calculation.ProtocolCalculationService} (which only ever blocked
 * ARCHIVED, so a SIGNED/APPROVED/REPLACED protocol could still have its raw measurements and
 * calculated results silently overwritten) and {@link ProtocolDocumentGenerationService} (which
 * had no check at all, so a signed protocol's stored DOCX/PDF file id could be clobbered by a
 * fresh generation call).
 *
 * <p>Two policies, not one: most actions are only legal while
 * {@link ProtocolStatus#isEditable()} is true (DRAFT/CALCULATED/READY/NEEDS_REVISION). Document
 * generation is different on purpose - {@code ProtocolService.approve()} and {@code sign()}
 * legitimately call {@code generateDocx}/{@code generatePdf} while the protocol is still
 * READY_FOR_APPROVAL/APPROVED (i.e. already not "editable"), because that is exactly how the PDF
 * that gets signed comes to exist in the first place. What must never happen is regenerating (and
 * so overwriting) that file once the protocol has actually reached SIGNED, or any later terminal
 * state (REPLACED/CANCELLED/ARCHIVED) - see {@link #GENERATION_BLOCKED} below.
 */
@Component
public class ProtocolMutationGuard {

    private static final Set<ProtocolMutationAction> EDITABLE_ONLY = EnumSet.of(
            ProtocolMutationAction.UPDATE_HEADER,
            ProtocolMutationAction.ADD_RESULT,
            ProtocolMutationAction.UPDATE_RESULT,
            ProtocolMutationAction.DELETE_RESULT,
            ProtocolMutationAction.SAVE_RAW_MEASUREMENTS,
            ProtocolMutationAction.CALCULATE,
            ProtocolMutationAction.CHECK_NORMATIVES,
            ProtocolMutationAction.ATTACH_DEVICE,
            ProtocolMutationAction.DETACH_DEVICE,
            ProtocolMutationAction.IMPORT_EXCEL,
            ProtocolMutationAction.REFRESH_LABORATORY_DATA,
            ProtocolMutationAction.DELETE_PROTOCOL
    );

    /** Statuses in which document generation must never run again - the protocol has either
     *  already been signed (the stored PDF IS the signed artifact) or is in a terminal state
     *  derived from that signed artifact. Every other status (including the pre-sign
     *  READY_FOR_APPROVAL/APPROVED states) is fine. */
    private static final Set<ProtocolStatus> GENERATION_BLOCKED = EnumSet.of(
            ProtocolStatus.SIGNED, ProtocolStatus.REPLACED, ProtocolStatus.CANCELLED, ProtocolStatus.ARCHIVED
    );

    public void requireEditable(Protocol protocol, ProtocolMutationAction action) {
        if (protocol.getDeletedAt() != null) {
            throw immutable(protocol, action, "Протокол удалён и недоступен для изменения");
        }
        boolean allowed = EDITABLE_ONLY.contains(action)
                ? protocol.getStatus().isEditable()
                : !GENERATION_BLOCKED.contains(protocol.getStatus());
        if (!allowed) {
            throw immutable(protocol, action,
                    "Подписанный или архивный протокол нельзя изменять");
        }
    }

    private ProtocolImmutableException immutable(Protocol protocol, ProtocolMutationAction action, String message) {
        Map<String, String> details = new LinkedHashMap<>();
        details.put("protocolId", String.valueOf(protocol.getId()));
        details.put("status", protocol.getStatus().name());
        details.put("action", action.name());
        return new ProtocolImmutableException(message, details);
    }
}
