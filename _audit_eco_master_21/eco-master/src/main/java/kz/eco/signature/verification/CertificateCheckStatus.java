package kz.eco.signature.verification;

/** Outcome of one certificate-hardening check (chain/CRL/OCSP/TSA). Never conflate "not checked"
 *  with "checked and passed" - {@link #NOT_CONFIGURED} and {@link #CHECK_ERROR} are both honest
 *  "we don't actually know" states, distinct from {@link #PASSED}. */
public enum CertificateCheckStatus {
    /** The check ran and found no problem. */
    PASSED,
    /** The check ran and found a definitive problem (e.g. chain doesn't validate, CRL/OCSP
     *  explicitly reports revoked). */
    FAILED,
    /** The check is disabled/unconfigured (no trust store, no CRL/OCSP enabled) - never reported
     *  as PASSED. */
    NOT_CONFIGURED,
    /** The check is enabled/configured but could not complete (network/timeout/parse failure) -
     *  fail-open: does not block signing by itself, but is never reported as PASSED either. */
    CHECK_ERROR,
    /** TSA-only: no timestamp token was supplied - optional per module spec ("если используется"),
     *  not a failure. */
    NOT_PROVIDED
}
