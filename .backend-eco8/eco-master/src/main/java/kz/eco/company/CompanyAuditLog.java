package kz.eco.company;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Generic entityType/entityId shape (not a company-specific companyId column) so both Company and
 *  CompanyObject actions share one audit trail, per the spec's field list. Deliberately does not
 *  store old/new values - only which field NAMES changed, so no business or personal data ends up
 *  in the audit log beyond what the field name itself reveals. */
@Entity
@Table(name = "company_audit_logs")
public class CompanyAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String entityType;

    @Column(nullable = false)
    private Long entityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CompanyAuditAction action;

    private Long userId;

    @Column(length = 255)
    private String userName;

    @Column(length = 500)
    private String changedFields;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public CompanyAuditAction getAction() { return action; }
    public void setAction(CompanyAuditAction action) { this.action = action; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getChangedFields() { return changedFields; }
    public void setChangedFields(String changedFields) { this.changedFields = changedFields; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
