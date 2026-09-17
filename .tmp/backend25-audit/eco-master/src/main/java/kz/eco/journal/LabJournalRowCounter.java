package kz.eco.journal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/** One row per (laboratory, journal type), tracking the last row number issued. Mutated under a
 *  pessimistic write lock (see LabJournalRowCounterRepository/Service) so concurrent POSTs for the
 *  same lab+type never hand out the same rowNumber twice - the plain MAX(row_num)+1 query this
 *  replaces had no such guarantee. */
@Entity
@Table(name = "lab_journal_row_counters")
@IdClass(LabJournalRowCounterId.class)
public class LabJournalRowCounter {

    @Id
    @Column(name = "laboratory_id")
    private Long laboratoryId;

    @Id
    @Column(name = "journal_type", length = 100)
    private String journalType;

    @Column(name = "last_row_number", nullable = false)
    private int lastRowNumber;

    public LabJournalRowCounter() {
    }

    public LabJournalRowCounter(Long laboratoryId, String journalType, int lastRowNumber) {
        this.laboratoryId = laboratoryId;
        this.journalType = journalType;
        this.lastRowNumber = lastRowNumber;
    }

    public Long getLaboratoryId() { return laboratoryId; }
    public void setLaboratoryId(Long laboratoryId) { this.laboratoryId = laboratoryId; }
    public String getJournalType() { return journalType; }
    public void setJournalType(String journalType) { this.journalType = journalType; }
    public int getLastRowNumber() { return lastRowNumber; }
    public void setLastRowNumber(int lastRowNumber) { this.lastRowNumber = lastRowNumber; }
}
