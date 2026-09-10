package kz.eco.documentlibrary;

/** Wraps an unexpected kz.eco.storage.FileStorageService I/O failure (store/load/delete) - the
 *  raw IOException/message is never surfaced to the client (no path/stack leakage), only logged
 *  server-side by GlobalExceptionHandler with a traceId. Maps to HTTP 500,
 *  code CRM_DOCUMENT_STORAGE_ERROR. */
public class CrmDocumentStorageException extends RuntimeException {

    public static final String CODE = "CRM_DOCUMENT_STORAGE_ERROR";

    public CrmDocumentStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
