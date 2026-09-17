package kz.eco.pek;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * One generated DOCX/PDF snapshot of a PEK final report (Iteration 3 of the PEK module overhaul).
 * Old versions are never deleted or updated - every generateDocx/generatePdf call appends a new
 * row (see PekReportDocumentGenerationService). snapshotJson is the exact data used to render the
 * document, kept for audit/reproducibility even if the report's underlying rows later change.
 */
@Entity
@Table(name = "pek_report_document_versions", indexes =
        @Index(name = "ix_pek_report_document_versions_report_id", columnList = "report_id"))
public class PekReportDocumentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(nullable = false)
    private Integer version;

    /** OFFICIAL (state-facing, rendered from the versioned normative template per Правила №250)
     *  or INTERNAL (CRM analytical, not subject to normative template constraints). */
    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 40)
    private PekReportDocumentType documentType = PekReportDocumentType.OFFICIAL;

    /** Set only for {@link PekReportDocumentType#EMISSIONS_XLSX}. */
    @Column(name = "xlsx_file_id", length = 64)
    private String xlsxFileId;

    /** The program's contentRevision at render time, for document types that print program data
     *  (explanatory note, measures, emissions table). Editing the program bumps only the program's
     *  counter, so without this such a document would not be detected as stale. Null = not tracked. */
    @Column(name = "source_program_content_revision")
    private Long sourceProgramContentRevision;

    public String getXlsxFileId() { return xlsxFileId; }
    public void setXlsxFileId(String v) { xlsxFileId = v; }
    public Long getSourceProgramContentRevision() { return sourceProgramContentRevision; }
    public void setSourceProgramContentRevision(Long v) { sourceProgramContentRevision = v; }

    /** The regulation edition this document was generated under - copied from report.regulationVersion
     *  at generation time and immutable for this version row. */
    @Column(name = "regulation_version", nullable = false, length = 500)
    private String regulationVersion = PekRegulationVersionService.CURRENT;

    /** The normative template version used to render this document - copied from report.templateVersion
     *  at generation time and immutable for this version row. OFFICIAL documents must always
     *  carry a non-legacy templateVersion when the regulation mandates a specific template edition. */
    @Column(name = "template_version", nullable = false, length = 40)
    private String templateVersion = "v1-legacy";

    /** columnDefinition is pinned, not left to @Lob: on a schema built by ddl-auto (production never
     *  ran V78, which declares LONGTEXT) Hibernate created this as TINYTEXT - 255 bytes - and every
     *  document generation failed on "Data too long" for a multi-kilobyte snapshot. */
    @Lob
    @Column(name = "snapshot_json", nullable = false, columnDefinition = "LONGTEXT")
    private String snapshotJson;

    @Column(name = "docx_file_id", length = 64)
    private String docxFileId;

    @Column(name = "pdf_file_id", length = 64)
    private String pdfFileId;

    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    /** The PekReport's {@code contentRevision} at the moment this DOCX/PDF was rendered (NOT the
     *  JPA {@code version} - that only bumps when the pek_reports row itself is directly updated,
     *  missing most report-content edits). Every download/approve/sign check must reject with
     *  409 PEK_DOCUMENT_STALE whenever report.getContentRevision() has since moved past this. */
    @Column(name = "source_content_revision")
    private Long sourceContentRevision;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt = LocalDateTime.now();

    @Column(name = "generated_by", nullable = false)
    private Long generatedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long v) { reportId = v; }
    public PekReportDocumentType getDocumentType() { return documentType; }
    public void setDocumentType(PekReportDocumentType v) { documentType = v; }
    public String getRegulationVersion() { return regulationVersion; }
    public void setRegulationVersion(String v) { regulationVersion = v; }
    public String getTemplateVersion() { return templateVersion; }
    public void setTemplateVersion(String v) { templateVersion = v; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer v) { version = v; }
    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String v) { snapshotJson = v; }
    public String getDocxFileId() { return docxFileId; }
    public void setDocxFileId(String v) { docxFileId = v; }
    public String getPdfFileId() { return pdfFileId; }
    public void setPdfFileId(String v) { pdfFileId = v; }
    public String getContentHash() { return contentHash; }
    public void setContentHash(String v) { contentHash = v; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime v) { generatedAt = v; }
    public Long getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(Long v) { generatedBy = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getSourceContentRevision() { return sourceContentRevision; }
    public void setSourceContentRevision(Long v) { sourceContentRevision = v; }
}
