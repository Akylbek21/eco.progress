package kz.eco.order;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum PrimaryDocumentStatus {
    need_upload("need_upload"),
    uploaded("uploaded"),
    in_review("in_review"),
    approved("approved"),
    rejected("rejected"),
    needs_fix("needs_fix");

    private final String value;

    PrimaryDocumentStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    @JsonCreator
    public static PrimaryDocumentStatus fromValue(String v) {
        if ("under_review".equals(v)) return in_review;
        if ("accepted".equals(v)) return approved;
        for (PrimaryDocumentStatus s : values()) {
            if (s.value.equals(v)) return s;
        }
        throw new IllegalArgumentException("Unknown PrimaryDocumentStatus: " + v);
    }
}
