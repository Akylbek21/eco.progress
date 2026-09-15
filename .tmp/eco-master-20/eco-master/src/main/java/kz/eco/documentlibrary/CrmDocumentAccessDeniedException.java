package kz.eco.documentlibrary;

/** Authenticated staff user is not permitted to edit/archive/delete a document they don't own (and
 *  isn't ADMIN/DIRECTOR) - distinct from Spring Security's generic AccessDeniedException (role-gate
 *  failure) because this is an ownership check inside the service layer, not a @PreAuthorize
 *  failure. Wired into kz.eco.common.exception.GlobalExceptionHandler -&gt; HTTP 403, same pattern as
 *  ProtocolImmutableException/DocumentFlow*Exception. Carries its own {@code code} (rather than a
 *  single fixed constant) so the delete path can surface {@code DOCUMENT_DELETE_FORBIDDEN} per the
 *  /api/staff/documents contract, distinct from the generic edit-path denial code. */
public class CrmDocumentAccessDeniedException extends RuntimeException {

    public static final String CODE = "CRM_DOCUMENT_ACCESS_DENIED";

    private final String code;

    public CrmDocumentAccessDeniedException(String message) {
        this(message, CODE);
    }

    public CrmDocumentAccessDeniedException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
