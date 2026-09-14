package kz.ecoprogress.documentflow.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_flow_documents", indexes = {
        @Index(name = "idx_dfd_org", columnList = "organization_id"),
        @Index(name = "idx_dfd_status", columnList = "status"),
        @Index(name = "idx_dfd_public_id", columnList = "public_id"),
        @Index(name = "idx_dfd_counterparty", columnList = "counterparty_id")
})
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Random external-facing identifier - never the raw DB id - for URLs shared with
     *  counterparties/signers outside the owning organization. */
    @Column(name = "public_id", nullable = false, unique = true, length = 40)
    private String publicId = UUID.randomUUID().toString();

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "sender_organization_id")
    private Long senderOrganizationId;

    @Column(name = "recipient_organization_id")
    private Long recipientOrganizationId;

    @Column(name = "counterparty_id")
    private Long counterpartyId;

    @Column(name = "document_number", length = 100)
    private String documentNumber;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "description", length = 4000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 60)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 20)
    private DocumentDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private DocumentStatus status = DocumentStatus.DRAFT;

    @Column(name = "current_version_id")
    private Long currentVersionId;

    @Column(name = "author_user_id", nullable = false)
    private Long authorUserId;

    @Column(name = "signing_deadline")
    private LocalDateTime signingDeadline;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getSenderOrganizationId() { return senderOrganizationId; }
    public void setSenderOrganizationId(Long senderOrganizationId) { this.senderOrganizationId = senderOrganizationId; }
    public Long getRecipientOrganizationId() { return recipientOrganizationId; }
    public void setRecipientOrganizationId(Long recipientOrganizationId) { this.recipientOrganizationId = recipientOrganizationId; }
    public Long getCounterpartyId() { return counterpartyId; }
    public void setCounterpartyId(Long counterpartyId) { this.counterpartyId = counterpartyId; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }
    public DocumentDirection getDirection() { return direction; }
    public void setDirection(DocumentDirection direction) { this.direction = direction; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    public Long getCurrentVersionId() { return currentVersionId; }
    public void setCurrentVersionId(Long currentVersionId) { this.currentVersionId = currentVersionId; }
    public Long getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(Long authorUserId) { this.authorUserId = authorUserId; }
    public LocalDateTime getSigningDeadline() { return signingDeadline; }
    public void setSigningDeadline(LocalDateTime signingDeadline) { this.signingDeadline = signingDeadline; }
    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
