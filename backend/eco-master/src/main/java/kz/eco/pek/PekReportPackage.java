package kz.eco.pek;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "pek_report_packages",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_report_package_version", columnNames = {"report_id", "document_version"}))
public class PekReportPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "document_version", nullable = false)
    private Integer documentVersion;

    /** The PekReport's contentRevision at generation time - checked against the report's current
     *  contentRevision before download (module fix: renamed from source_report_version, which
     *  compared against the JPA @Version instead, missing most report-content edits). */
    @Column(name = "source_content_revision", nullable = false)
    private Long sourceContentRevision;

    @Lob
    @Column(name = "snapshot_json", nullable = false)
    private String snapshotJson;

    @Lob
    @Column(name = "missing_fields_json", nullable = false)
    private String missingFieldsJson;

    @Column(name = "zip_file_id", length = 64)
    private String zipFileId;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt = LocalDateTime.now();

    @Column(name = "generated_by", nullable = false)
    private Long generatedBy;

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long v) { reportId = v; }
    public Integer getDocumentVersion() { return documentVersion; }
    public void setDocumentVersion(Integer v) { documentVersion = v; }
    public Long getSourceContentRevision() { return sourceContentRevision; }
    public void setSourceContentRevision(Long v) { sourceContentRevision = v; }
    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String v) { snapshotJson = v; }
    public String getMissingFieldsJson() { return missingFieldsJson; }
    public void setMissingFieldsJson(String v) { missingFieldsJson = v; }
    public String getZipFileId() { return zipFileId; }
    public void setZipFileId(String v) { zipFileId = v; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public Long getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(Long v) { generatedBy = v; }
    public Long getVersion() { return version; }
}
