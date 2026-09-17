package kz.eco.signaturedoc;

/** Deliberately a distinct enum from kz.ecoprogress.documentflow.signing.VerificationStatus rather
 *  than reused directly - that enum lives in the documentflow module this feature is intentionally
 *  decoupled from, and this module needs FAILED as a catch-all for the several distinct rejection
 *  reasons this flow can produce (hash mismatch, invalid CMS, owner mismatch, etc. - see
 *  SignatureDocumentSigningService), which the specific error code on the audit log already
 *  captures precisely; the shape (successful vs failed + a documented certificate-expiry case) is
 *  intentionally mirrored though. */
public enum SignatureDocumentVerificationStatus {
    VERIFIED,
    FAILED,
    /** Certificate outside its notBefore/notAfter window at signedAt - see CERTIFICATE_EXPIRED. */
    CERTIFICATE_EXPIRED,
    /** CRL or OCSP returned a definitive revoked result (module spec item 5) - see
     *  kz.eco.signature.verification.CertificateVerificationService. */
    CERTIFICATE_REVOKED,
    /** P1 module fix: distinct from CERTIFICATE_REVOKED - the chain/CRL/OCSP status genuinely
     *  could not be established (NOT_CONFIGURED/CHECK_ERROR, never an explicit revoked result) and
     *  eco.signature.strict-verification-required rejected the signature for that reason. Never
     *  persisted as CERTIFICATE_REVOKED - that would misreport "this certificate IS revoked" when
     *  the true, weaker fact is "we could not confirm it wasn't". */
    TRUST_NOT_VERIFIED
}
