package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** One evidence file attached to a {@link PekReportExceedance}'s corrective-action workflow
 *  (module spec Iteration 2) - stores only the fileId from {@link kz.eco.storage.FileStorageService},
 *  never bytes, mirroring {@link PekProgramDocument}'s pattern. Immutable once written. */
@Entity
@Table(name = "pek_exceedance_evidence_files")
public class PekExceedanceEvidenceFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "exceedance_id", nullable = false)
    private Long exceedanceId;

    @Column(name = "file_id", nullable = false, length = 64)
    private String fileId;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getExceedanceId() { return exceedanceId; }
    public void setExceedanceId(Long exceedanceId) { this.exceedanceId = exceedanceId; }
    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public Long getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(Long uploadedBy) { this.uploadedBy = uploadedBy; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
}
