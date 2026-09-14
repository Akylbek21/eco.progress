package kz.eco.normative;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "normative_import_batches")
public class ImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String fileName;

    @Column(length = 30)
    private String status;

    private int totalRows;
    private int validRows;
    private int errorRows;
    private int duplicates;
    private int newPollutants;
    private int newNormatives;
    private int updatedNormatives;

    @Column(columnDefinition = "TEXT")
    private String errorsJson;

    private Long userId;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime confirmedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getTotalRows() { return totalRows; }
    public void setTotalRows(int totalRows) { this.totalRows = totalRows; }
    public int getValidRows() { return validRows; }
    public void setValidRows(int validRows) { this.validRows = validRows; }
    public int getErrorRows() { return errorRows; }
    public void setErrorRows(int errorRows) { this.errorRows = errorRows; }
    public int getDuplicates() { return duplicates; }
    public void setDuplicates(int duplicates) { this.duplicates = duplicates; }
    public int getNewPollutants() { return newPollutants; }
    public void setNewPollutants(int newPollutants) { this.newPollutants = newPollutants; }
    public int getNewNormatives() { return newNormatives; }
    public void setNewNormatives(int newNormatives) { this.newNormatives = newNormatives; }
    public int getUpdatedNormatives() { return updatedNormatives; }
    public void setUpdatedNormatives(int updatedNormatives) { this.updatedNormatives = updatedNormatives; }
    public String getErrorsJson() { return errorsJson; }
    public void setErrorsJson(String errorsJson) { this.errorsJson = errorsJson; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }
}
