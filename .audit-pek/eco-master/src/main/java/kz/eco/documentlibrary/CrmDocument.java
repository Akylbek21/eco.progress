package kz.eco.documentlibrary;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** General CRM document archive entry. Deliberately standalone: no FK/columns referencing
 *  orders, companies, protocols, PEK, or kz.ecoprogress.documentflow tables - see task spec. The
 *  actual file bytes live in kz.eco.storage.FileStorageService, addressed by {@link #fileId}. */
@Entity
@Table(name = "crm_documents")
public class CrmDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String title;

    /** Free-form category string (module: /api/staff/documents contract) - not a closed enum
     *  anymore, since the frontend contract sends/expects arbitrary lowercase category keys
     *  ("permit", "protocol", ...) rather than a fixed vocabulary the backend would reject
     *  unknown values for. {@link CrmDocumentCategory} still exists as a suggested-values list for
     *  {@code GET /categories}, independent of what's actually stored here. */
    @Column(nullable = false, length = 40)
    private String category;

    @Column(length = 2000)
    private String comment;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @Column(name = "file_id", nullable = false, unique = true, length = 64)
    private String fileId;

    @Column(name = "original_filename", nullable = false, length = 300)
    private String originalFilename;

    @Column(name = "mime_type", nullable = false, length = 120)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private Long uploadedByUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(nullable = false)
    private boolean archived = false;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "archived_by_user_id")
    private Long archivedByUserId;

    /** Boxed-avoiding primitive version, same pattern as kz.eco.signaturedoc.SignatureDocument:
     *  entities of this type are always created fresh via {@code new CrmDocument()} then saved,
     *  never reconstructed with a pre-set id, so Spring Data's default isNew() check works. */
    @Version
    @Column(nullable = false)
    private long version;

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDate getDocumentDate() { return documentDate; }
    public void setDocumentDate(LocalDate documentDate) { this.documentDate = documentDate; }
    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public Long getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(Long uploadedByUserId) { this.uploadedByUserId = uploadedByUserId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }
    public Long getArchivedByUserId() { return archivedByUserId; }
    public void setArchivedByUserId(Long archivedByUserId) { this.archivedByUserId = archivedByUserId; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
