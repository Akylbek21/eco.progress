package kz.eco.order;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum MeasurementAgreementStatus {
    draft("draft"),
    sent("sent"),
    accepted("accepted"),
    rejected("rejected"),
    rescheduled("rescheduled"),
    confirmed("confirmed"),
    completed("completed");

    private final String value;

    MeasurementAgreementStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    @JsonCreator
    public static MeasurementAgreementStatus fromValue(String v) {
        for (MeasurementAgreementStatus s : values()) {
            if (s.value.equals(v)) return s;
        }
        throw new IllegalArgumentException("Unknown MeasurementAgreementStatus: " + v);
    }
}
