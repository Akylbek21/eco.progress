package kz.eco.content;

/** Trust/expertise verification state for Expert and TrustDocument records. UNVERIFIED is the
 *  default for anything newly entered - it must never leak into the public API (see each entity's
 *  repository query / controller filter), so production data can't sit "requires-review" forever
 *  while still being served to the public as if it were confirmed. */
public enum VerificationStatus {
    UNVERIFIED,
    PENDING_VERIFICATION,
    VERIFIED,
    REJECTED
}
