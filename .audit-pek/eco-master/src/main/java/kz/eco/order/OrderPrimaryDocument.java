package kz.eco.order;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "order_primary_documents", indexes = {
    @Index(name = "idx_opd_order", columnList = "order_id"),
    @Index(name = "idx_opd_group", columnList = "documentGroup")
})
public class OrderPrimaryDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(length = 20)
    private String documentGroup;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(nullable = false)
    private boolean required;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PrimaryDocumentStatus status = PrimaryDocumentStatus.need_upload;

    @Column(length = 300)
    private String fileName;

    @Column(length = 1000)
    private String fileUrl;

    @Column(length = 500)
    private String storedPath;

    @Column(length = 2000)
    private String clientComment;

    @Column(length = 2000)
    private String staffComment;

    private LocalDateTime requestedAt;
    private LocalDateTime uploadedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime rejectedAt;
    private LocalDateTime fixRequestedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public String getDocumentGroup() { return documentGroup; }
    public void setDocumentGroup(String documentGroup) { this.documentGroup = documentGroup; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public PrimaryDocumentStatus getStatus() { return status; }
    public void setStatus(PrimaryDocumentStatus status) { this.status = status; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getStoredPath() { return storedPath; }
    public void setStoredPath(String storedPath) { this.storedPath = storedPath; }
    public String getClientComment() { return clientComment; }
    public void setClientComment(String clientComment) { this.clientComment = clientComment; }
    public String getStaffComment() { return staffComment; }
    public void setStaffComment(String staffComment) { this.staffComment = staffComment; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public LocalDateTime getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(LocalDateTime rejectedAt) { this.rejectedAt = rejectedAt; }
    public LocalDateTime getFixRequestedAt() { return fixRequestedAt; }
    public void setFixRequestedAt(LocalDateTime fixRequestedAt) { this.fixRequestedAt = fixRequestedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
