package kz.eco.signature.verification;

/** Aggregate result of the four certificate-hardening checks run at signing time (module spec
 *  item 5: chain/CRL/OCSP/TSA). {@code revoked} is true only when CRL or OCSP returned a
 *  definitive, positive revocation result - that is the ONE condition that blocks signing;
 *  everything else (NOT_CONFIGURED, CHECK_ERROR, a failed chain build) is recorded honestly but
 *  does not by itself reject the signature, per the module's graceful-fail-open posture. */
public record CertificateVerificationResult(
        CertificateCheckStatus chainStatus,
        String chainDetail,
        CertificateCheckStatus crlStatus,
        String crlDetail,
        CertificateCheckStatus ocspStatus,
        String ocspDetail,
        CertificateCheckStatus tsaStatus,
        String tsaDetail,
        boolean revoked,
        String revocationDetail
) {
    /** True only when chain/CRL/OCSP all actually ran and found no problem - never true when any
     *  of them is NOT_CONFIGURED or CHECK_ERROR. Used to gate strict/production signing: fail-open
     *  is fine as a default posture, but a deployment that opts into strict verification must
     *  reject a signature whose trust/revocation status genuinely could not be established,
     *  rather than silently accepting an "unknown" as if it were "trusted". TSA is deliberately
     *  excluded (optional per module spec). */
    public boolean trustFullyVerified() {
        return chainStatus == CertificateCheckStatus.PASSED
                && crlStatus == CertificateCheckStatus.PASSED
                && ocspStatus == CertificateCheckStatus.PASSED;
    }
}
