package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import kz.eco.user.UserRole;

import java.time.LocalDateTime;

/**
 * PEK-native company membership - which user may see/act on a given company's PEK data (Iteration
 * 1, see the module overhaul plan's "Key design decisions" §1). Deliberately NOT a reuse of
 * {@code kz.ecoprogress.documentflow.membership.DocumentFlowMembership}: that table belongs to a
 * different bounded context (external routed signing/org onboarding) and {@code PekSettingsService}
 * already had a documented erroneous cross-module dependency on it - reusing it here would deepen
 * that coupling instead of fixing it. Table starts empty on creation (no safe backfill source
 * exists); ADMIN/DIRECTOR bypass membership checks entirely (see
 * {@link PekAccessService#hasGlobalAccess(UserRole)}), so those roles keep working immediately
 * after the migration lands - other staff need a membership row seeded operationally.
 */
@Entity
@Table(name = "pek_company_memberships", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pek_company_membership", columnNames = {"company_id", "user_id"})
})
public class PekCompanyMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_code", nullable = false, length = 20)
    private UserRole roleCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PekMembershipStatus status = PekMembershipStatus.ACTIVE;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Column(name = "invited_by")
    private Long invitedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public UserRole getRoleCode() { return roleCode; }
    public void setRoleCode(UserRole roleCode) { this.roleCode = roleCode; }
    public PekMembershipStatus getStatus() { return status; }
    public void setStatus(PekMembershipStatus status) { this.status = status; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
    public Long getInvitedBy() { return invitedBy; }
    public void setInvitedBy(Long invitedBy) { this.invitedBy = invitedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
