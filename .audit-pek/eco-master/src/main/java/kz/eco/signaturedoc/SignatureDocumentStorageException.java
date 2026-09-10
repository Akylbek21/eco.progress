package kz.eco.signaturedoc;

/** Wraps an unexpected kz.eco.storage.FileStorageService I/O failure (store/load) - the raw
 *  IOException/message is never surfaced to the client, only logged server-side by
 *  GlobalExceptionHandler with a traceId. Maps to HTTP 500, code SIGNATURE_DOCUMENT_STORAGE_ERROR.
 *  Mirrors kz.eco.documentlibrary.CrmDocumentStorageException - previously this module let such
 *  failures fall through as a bare IllegalStateException into the generic 500 handler. */
public class SignatureDocumentStorageException extends RuntimeException {

    public static final String CODE = "SIGNATURE_DOCUMENT_STORAGE_ERROR";

    public SignatureDocumentStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
