package kz.ecoprogress.documentflow.signing;

/** 422 with a business code - e.g. INVALID_CMS / CERTIFICATE_EXPIRED / CERTIFICATE_REVOKED /
 *  DOCUMENT_HASH_MISMATCH / SIGNER_IIN_MISMATCH. */
public class UnprocessableEntityException extends RuntimeException {

    private final String code;

    public UnprocessableEntityException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
