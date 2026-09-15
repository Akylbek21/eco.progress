package kz.ecoprogress.documentflow.access;

import kz.ecoprogress.documentflow.plan.FeatureCode;

/** Thrown by {@link DocumentFlowAccessService#requireFeature}. Two distinct causes get two
 *  distinct codes so the frontend can tell "upgrade your plan" apart from "an admin turned this
 *  off for you" - {@code code()} is {@code PLAN_DOES_NOT_SUPPORT_<FEATURE>} when the plan itself
 *  never had the feature, or the literal {@code DOCUMENT_FLOW_FEATURE_DISABLED} when an active
 *  entitlement override explicitly disabled a feature the plan does support. Mapped to HTTP 403. */
public class DocumentFlowFeatureNotAvailableException extends RuntimeException {

    private final String code;

    public static DocumentFlowFeatureNotAvailableException planDoesNotSupport(FeatureCode feature) {
        return new DocumentFlowFeatureNotAvailableException(
                "Тарифный план не поддерживает функцию " + feature.name(),
                "PLAN_DOES_NOT_SUPPORT_" + feature.name());
    }

    public static DocumentFlowFeatureNotAvailableException disabledByEntitlement(FeatureCode feature) {
        return new DocumentFlowFeatureNotAvailableException(
                "Функция " + feature.name() + " отключена для организации", "DOCUMENT_FLOW_FEATURE_DISABLED");
    }

    private DocumentFlowFeatureNotAvailableException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String code() { return code; }
}
