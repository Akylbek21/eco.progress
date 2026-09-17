package kz.eco.protocol;

public enum ProtocolAuditAction {
    CREATED,
    UPDATED,
    NORMATIVE_CHECK,
    DOCX_GENERATED,
    PDF_GENERATED,
    APPROVED,
    SIGNED,
    DOWNLOADED,
    CANCELLED,
    REPLACED,
    ARCHIVED,
    DELETED,
    PUBLISHED_TO_CLIENT,
    /** Module spec §13: previously logged as generic UPDATED, collapsing the actual transition
     *  into a single indistinguishable action type in the audit trail. */
    READY_FOR_APPROVAL,
    RETURNED_FOR_REVISION,
    RETURNED_TO_DRAFT,
    SECOND_SIGNATURE,
    /** A result row's normative was set manually (no normativeId resolved from the reference
     *  database) rather than picked from a matched NormativeReference - requires a reason,
     *  logged separately from generic UPDATED so the audit trail can distinguish "operator
     *  overrode the normative" from any other row edit. */
    MANUAL_NORMATIVE_OVERRIDE,
    SAMPLING_POINT_ADDED,
    SAMPLING_POINT_UPDATED,
    SAMPLING_POINT_DELETED,
    INDICATORS_COPIED
}
