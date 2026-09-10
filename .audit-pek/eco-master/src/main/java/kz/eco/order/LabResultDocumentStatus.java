package kz.eco.order;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum LabResultDocumentStatus {
    pending("pending"),
    uploaded("uploaded"),
    under_review("under_review"),
    approved("approved"),
    rejected("rejected");

    private final String value;

    LabResultDocumentStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    @JsonCreator
    public static LabResultDocumentStatus fromValue(String v) {
        for (LabResultDocumentStatus s : values()) {
            if (s.value.equals(v)) return s;
        }
        throw new IllegalArgumentException("Unknown LabResultDocumentStatus: " + v);
    }
}
