package kz.eco.signaturedoc;

/**
 * Role-matrix constants for the Signature Documents feature, following the same static-SpEL-string
 * pattern as kz.eco.pek.PekSecurityExpressions / kz.eco.user.SecurityExpressions. There is no
 * DB-backed fine-grained permission table anywhere in this project, so these map directly to
 * UserRole-based {@code @PreAuthorize(hasAnyRole(...))} expressions - all staff roles get
 * READ/CREATE/SIGN/DOWNLOAD/ARCHIVE on their OWN documents (ownership enforced imperatively in the
 * service layer, exactly like PekAccessService does for company scope - a role expression alone
 * cannot express "and only their own row").
 *
 * <p>"системный администратор может получить расширенный доступ только при наличии отдельного
 * системного permission" is implemented as a SEPARATE, explicitly-gated check
 * (SIGNATURE_DOCUMENT_ADMIN_VIEW) consulted only in SignatureDocumentService's read paths - unlike
 * PekSecurityExpressions/PekAccessService's blanket "ADMIN always has global access", ADMIN here
 * does NOT implicitly bypass ownership; extended access is a distinct, narrower carve-out.
 */
public final class SignatureDocumentSecurityExpressions {

    public static final String SIGNATURE_DOCUMENT_READ =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')";
    public static final String SIGNATURE_DOCUMENT_CREATE = SIGNATURE_DOCUMENT_READ;
    public static final String SIGNATURE_DOCUMENT_SIGN = SIGNATURE_DOCUMENT_READ;
    public static final String SIGNATURE_DOCUMENT_DOWNLOAD = SIGNATURE_DOCUMENT_READ;
    public static final String SIGNATURE_DOCUMENT_ARCHIVE = SIGNATURE_DOCUMENT_READ;

    /** Extended, cross-owner visibility within the same company - explicitly narrower than "is
     *  ADMIN": checked separately in the service layer, never folded into the blanket READ role
     *  check above. Currently ADMIN-only; kept as its own named constant so widening it later (or
     *  wiring a real permission flag) doesn't require touching call sites. */
    public static final String SIGNATURE_DOCUMENT_ADMIN_VIEW =
            "hasRole('ADMIN')";

    private SignatureDocumentSecurityExpressions() {
    }
}
