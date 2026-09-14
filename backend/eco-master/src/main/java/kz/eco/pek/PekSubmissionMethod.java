package kz.eco.pek;

/**
 * How a signed ПЭК report was actually handed to the regulator.
 *
 * <p>There is deliberately no automatic push to a government portal here: no official external
 * API is available for ПЭК submission, so the act of submitting stays manual and this module only
 * records what a human did (module spec P1, item 21). {@link #EGOV_PORTAL} therefore means "a
 * person uploaded it to the portal and typed the registration number back in", not "the system
 * sent it".
 */
public enum PekSubmissionMethod {
    /** Uploaded by hand to the state portal; registrationNumber is the portal's receipt. */
    EGOV_PORTAL,
    /** Sent by email to the regulator's office. */
    EMAIL,
    /** Delivered on paper, in person or by registered post. */
    PAPER,
    /** Handed over by courier. */
    COURIER,
    /** Anything else - submissionComment is expected to say what. */
    OTHER
}
