package kz.eco.protocol;

/** Every action that mutates a protocol or its generated documents, in one enum (module spec §5) -
 *  so {@link ProtocolMutationGuard} has a single, exhaustive policy table instead of each service
 *  re-deriving (or forgetting) its own status check. See {@link ProtocolMutationGuard} for which
 *  statuses each action is allowed in - it is NOT simply "editable or not": document generation
 *  legitimately still runs on APPROVED/READY_FOR_APPROVAL protocols (approve()/sign() call it
 *  before the protocol becomes SIGNED), it just must never run again once actually SIGNED. */
public enum ProtocolMutationAction {
    UPDATE_HEADER,
    ADD_RESULT,
    UPDATE_RESULT,
    DELETE_RESULT,
    SAVE_RAW_MEASUREMENTS,
    CALCULATE,
    CHECK_NORMATIVES,
    ATTACH_DEVICE,
    DETACH_DEVICE,
    IMPORT_EXCEL,
    REFRESH_LABORATORY_DATA,
    GENERATE_DOCX,
    GENERATE_PDF,
    DELETE_PROTOCOL
}
