package kz.eco.signaturedoc;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "signature_documents")
public class SignatureDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Optional/unused going forward (module spec: no OrganizationResolver/company-tenant scoping
     *  for this module - visibility is own-documents-only, ADMIN sees all). Column kept nullable
     *  rather than dropped for backward compatibility with any already-stored rows. */
    @Column(name = "company_id")
    private Long companyId;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(name = "original_file_name", nullable = false, length = 300)
    private String originalFileName;

    @Column(name = "mime_type", nullable = false, length = 120)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "storage_file_id", nullable = false, length = 64)
    private String storageFileId;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SignatureDocumentStatus status = SignatureDocumentStatus.DRAFT;

    /** Primitive long with an explicit default - unlike SigningRoute.version/Protocol.version this
     *  entity is always created via {@code new SignatureDocument()} + repository.save() (never
     *  reconstructed with an explicit pre-set id), so Spring Data's default isNew() check (id ==
     *  null) already works correctly and the boxed-Long-no-initializer trick documented on those
     *  other entities is not needed here. */
    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getOriginalFileName() { return originalFileName; }
    public void setOriginalFileName(String originalFileName) { this.originalFileName = originalFileName; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public String getStorageFileId() { return storageFileId; }
    public void setStorageFileId(String storageFileId) { this.storageFileId = storageFileId; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public SignatureDocumentStatus getStatus() { return status; }
    public void setStatus(SignatureDocumentStatus status) { this.status = status; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
}
