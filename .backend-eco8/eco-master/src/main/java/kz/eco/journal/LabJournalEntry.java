package kz.eco.journal;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "lab_journal_entries")
public class LabJournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "journal_type", nullable = false, length = 100)
    private String journalType;

    @Column(name = "row_num")
    private Integer rowNumber;

    @Column(name = "entry_date")
    private LocalDate entryDate;

    /** Raw JSON, hand-serialized in the service layer (same pattern as ProtocolResult.valuesJson). */
    @Column(name = "data", nullable = false, columnDefinition = "JSON")
    private String data;

    @Column(name = "laboratory_id", nullable = false)
    private Long laboratoryId;

    /**
     * Optional, soft link to the protocol/result that produced this journal row (section 29 of the
     * spec). Deliberately a plain Long/String, not a @ManyToOne - the journal module must not take
     * a hard dependency (or FK constraint) on the protocol tables. Never auto-updated after the
     * entry is signed; a later re-linked protocol does not retroactively change historical rows.
     */
    @Column(name = "protocol_id")
    private Long protocolId;

    @Column(name = "protocol_result_id")
    private Long protocolResultId;

    @Column(name = "sample_id", length = 64)
    private String sampleId;

    /**
     * Frozen JSON snapshot of which protocol result(s) fed this journal row, captured at link time.
     * Storage-only for now: populated by the protocol side later, not auto-filled here.
     */
    @Column(name = "results_snapshot", columnDefinition = "JSON")
    private String resultsSnapshot;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getJournalType() { return journalType; }
    public void setJournalType(String journalType) { this.journalType = journalType; }
    public Integer getRowNumber() { return rowNumber; }
    public void setRowNumber(Integer rowNumber) { this.rowNumber = rowNumber; }
    public LocalDate getEntryDate() { return entryDate; }
    public void setEntryDate(LocalDate entryDate) { this.entryDate = entryDate; }
    public String getData() { return data; }
    public void setData(String data) { this.data = data; }
    public Long getLaboratoryId() { return laboratoryId; }
    public void setLaboratoryId(Long laboratoryId) { this.laboratoryId = laboratoryId; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Long getProtocolResultId() { return protocolResultId; }
    public void setProtocolResultId(Long protocolResultId) { this.protocolResultId = protocolResultId; }
    public String getSampleId() { return sampleId; }
    public void setSampleId(String sampleId) { this.sampleId = sampleId; }
    public String getResultsSnapshot() { return resultsSnapshot; }
    public void setResultsSnapshot(String resultsSnapshot) { this.resultsSnapshot = resultsSnapshot; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
}
