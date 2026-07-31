package kz.ecoprogress.documentflow.signing;

/** 403 with a business code - e.g. PLAN_DOES_NOT_SUPPORT_MULTI_SIGNING /
 *  PLAN_DOES_NOT_SUPPORT_EXTERNAL_SIGNING / PLAN_DOES_NOT_SUPPORT_MIXED_SIGNING. */
public class ForbiddenException extends RuntimeException {

    private final String code;

    public ForbiddenException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
