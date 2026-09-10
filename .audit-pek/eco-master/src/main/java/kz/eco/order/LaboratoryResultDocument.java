package kz.eco.order;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "laboratory_result_documents", indexes =
    @Index(name = "idx_lrd_order", columnList = "order_id")
)
public class LaboratoryResultDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(length = 80)
    private String section;

    private Integer quarter;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LabResultDocumentStatus status = LabResultDocumentStatus.pending;

    @Column(length = 300)
    private String fileName;

    @Column(length = 1000)
    private String fileUrl;

    @Column(length = 500)
    private String storedPath;

    @Column(length = 2000)
    private String staffComment;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime uploadedAt;
    private LocalDateTime approvedAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }
    public Integer getQuarter() { return quarter; }
    public void setQuarter(Integer quarter) { this.quarter = quarter; }
    public LabResultDocumentStatus getStatus() { return status; }
    public void setStatus(LabResultDocumentStatus status) { this.status = status; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getStoredPath() { return storedPath; }
    public void setStoredPath(String storedPath) { this.storedPath = storedPath; }
    public String getStaffComment() { return staffComment; }
    public void setStaffComment(String staffComment) { this.staffComment = staffComment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
