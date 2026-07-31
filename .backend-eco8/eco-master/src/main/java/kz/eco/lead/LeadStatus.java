package kz.eco.lead;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum LeadStatus {
    new_lead("new"),
    contacted("contacted"),
    in_progress("in_progress"),
    closed("closed");

    private final String value;

    LeadStatus(String value) { this.value = value; }

    @JsonValue
    public String getValue() { return value; }

    @JsonCreator
    public static LeadStatus fromValue(String value) {
        if (value == null) return new_lead;
        for (LeadStatus s : values()) {
            if (s.value.equals(value) || s.name().equals(value)) return s;
        }
        return new_lead;
    }
}
