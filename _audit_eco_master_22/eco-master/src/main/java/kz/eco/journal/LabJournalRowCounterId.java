package kz.eco.journal;

import java.io.Serializable;
import java.util.Objects;

public class LabJournalRowCounterId implements Serializable {

    private Long laboratoryId;
    private String journalType;

    public LabJournalRowCounterId() {
    }

    public LabJournalRowCounterId(Long laboratoryId, String journalType) {
        this.laboratoryId = laboratoryId;
        this.journalType = journalType;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof LabJournalRowCounterId that)) return false;
        return Objects.equals(laboratoryId, that.laboratoryId) && Objects.equals(journalType, that.journalType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(laboratoryId, journalType);
    }
}
