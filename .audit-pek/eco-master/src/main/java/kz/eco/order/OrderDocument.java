package kz.eco.order;

import jakarta.persistence.*;
import kz.eco.user.User;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "order_documents", indexes = @Index(name = "idx_od_order", columnList = "order_id"))
public class OrderDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    private Long contractId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_user_id")
    private User uploadedByUser;

    @Column(length = 30)
    private String uploadedByRole;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(length = 300)
    private String fileName;

    @Column(columnDefinition = "TEXT")
    private String fileUrl;

    @Column(length = 120)
    private String mimeType;

    private Long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentType type = DocumentType.client;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentVisibility visibility = DocumentVisibility.client;

    @Column(length = 80)
    private String status;

    @Column(nullable = false)
    private boolean sentToClient = false;

    @Column(nullable = false)
    private boolean needsSignature = false;

    @Column(nullable = false)
    private boolean needsClientResponse = false;

    @Column(length = 40)
    private String clientResponseStatus;

    @Column(columnDefinition = "TEXT")
    private String staffComment;

    @Column(columnDefinition = "TEXT")
    private String clientComment;

    private LocalDate dueDate;

    @Column(length = 500)
    private String storedPath;

    @Column(columnDefinition = "LONGTEXT")
    private String signedCms;

    @Column(length = 500)
    private String signerSubject;

    private LocalDateTime signedAt;

    @Column(nullable = false)
    private LocalDateTime uploadedAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long contractId) { this.contractId = contractId; }
    public User getUploadedByUser() { return uploadedByUser; }
    public void setUploadedByUser(User uploadedByUser) { this.uploadedByUser = uploadedByUser; }
    public String getUploadedByRole() { return uploadedByRole; }
    public void setUploadedByRole(String uploadedByRole) { this.uploadedByRole = uploadedByRole; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public DocumentType getType() { return type; }
    public void setType(DocumentType type) { this.type = type; }
    public DocumentVisibility getVisibility() { return visibility; }
    public void setVisibility(DocumentVisibility visibility) { this.visibility = visibility; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isSentToClient() { return sentToClient; }
    public void setSentToClient(boolean sentToClient) { this.sentToClient = sentToClient; }
    public boolean isNeedsSignature() { return needsSignature; }
    public void setNeedsSignature(boolean needsSignature) { this.needsSignature = needsSignature; }
    public boolean isNeedsClientResponse() { return needsClientResponse; }
    public void setNeedsClientResponse(boolean needsClientResponse) { this.needsClientResponse = needsClientResponse; }
    public String getClientResponseStatus() { return clientResponseStatus; }
    public void setClientResponseStatus(String clientResponseStatus) { this.clientResponseStatus = clientResponseStatus; }
    public String getStaffComment() { return staffComment; }
    public void setStaffComment(String staffComment) { this.staffComment = staffComment; }
    public String getClientComment() { return clientComment; }
    public void setClientComment(String clientComment) { this.clientComment = clientComment; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getStoredPath() { return storedPath; }
    public void setStoredPath(String storedPath) { this.storedPath = storedPath; }
    public String getSignedCms() { return signedCms; }
    public void setSignedCms(String signedCms) { this.signedCms = signedCms; }
    public String getSignerSubject() { return signerSubject; }
    public void setSignerSubject(String signerSubject) { this.signerSubject = signerSubject; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
