package kz.eco.protocol;

public enum ResultInternalStatus {
    NORMAL,
    EXCEEDED,
    BELOW_REQUIRED,
    NORMATIVE_NOT_FOUND,
    UNIT_MISMATCH,
    EMPTY_RESULT,
    OK,
    MANUAL_NORMATIVE,
    NEEDS_REVIEW,
    INFO,
    /** Module spec §10 issue codes, additive to the set above (kept for backward compatibility -
     *  existing rows/tests already rely on those exact names). */
    NORMATIVE_NOT_SELECTED,
    NORMATIVE_INACTIVE,
    NORMATIVE_CONTEXT_MISMATCH,
    VALUE_NOT_PROVIDED,
    UNIT_NOT_PROVIDED,
    LIMIT_EXCEEDED,
    AMBIGUOUS_NORMATIVE
}
