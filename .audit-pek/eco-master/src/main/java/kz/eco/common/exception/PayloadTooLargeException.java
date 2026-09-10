package kz.eco.common.exception;

/** An uploaded file exceeds a business-configured size limit (as opposed to
 *  MaxUploadSizeExceededException, which is Spring's own multipart-config-wide limit) - maps to
 *  HTTP 413, not 400, per the ПЭК module's API contract (module spec §4). */
public class PayloadTooLargeException extends RuntimeException {

    private final String code;

    public PayloadTooLargeException(String message) {
        this(message, "PAYLOAD_TOO_LARGE");
    }

    public PayloadTooLargeException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
