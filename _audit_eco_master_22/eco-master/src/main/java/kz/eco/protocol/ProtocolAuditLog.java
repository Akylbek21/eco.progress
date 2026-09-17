package kz.eco.protocol;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "protocol_audit_logs")
public class ProtocolAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long protocolId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProtocolAuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ProtocolStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ProtocolStatus newStatus;

    private Long userId;

    @Column(length = 500)
    private String comment;

    /** Module spec §13: contentVersion (not the JPA @Version) before/after this operation - null
     *  for actions logged via the older 6-arg ProtocolAuditService.log() overload that don't
     *  supply it, additive so no existing call site had to change. */
    private Long oldVersion;
    private Long newVersion;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public ProtocolAuditAction getAction() { return action; }
    public void setAction(ProtocolAuditAction action) { this.action = action; }
    public ProtocolStatus getOldStatus() { return oldStatus; }
    public void setOldStatus(ProtocolStatus oldStatus) { this.oldStatus = oldStatus; }
    public ProtocolStatus getNewStatus() { return newStatus; }
    public void setNewStatus(ProtocolStatus newStatus) { this.newStatus = newStatus; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Long getOldVersion() { return oldVersion; }
    public void setOldVersion(Long oldVersion) { this.oldVersion = oldVersion; }
    public Long getNewVersion() { return newVersion; }
    public void setNewVersion(Long newVersion) { this.newVersion = newVersion; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
