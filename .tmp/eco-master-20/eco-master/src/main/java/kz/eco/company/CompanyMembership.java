package kz.eco.company;

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
 * Which user may see/act on a given company's data (tenant isolation for the Companies module -
 * previously absent entirely, same gap {@link kz.eco.pek.PekCompanyMembership} closed for PEK).
 * Table starts empty: no safe backfill source exists. ADMIN/DIRECTOR bypass membership checks
 * entirely (see {@link CompanyAccessService#hasGlobalAccess(UserRole)}), so those roles keep
 * working immediately after the migration; other staff need a membership row seeded operationally.
 */
@Entity
@Table(name = "company_memberships", uniqueConstraints = {
        @UniqueConstraint(name = "uk_company_membership", columnNames = {"company_id", "user_id"})
})
public class CompanyMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** P0 module fix item 13: informational per-company role label only (surfaced in
     *  CompanyMembershipDto for the UI to display "what this person's role on this team is") -
     *  {@link CompanyAccessService} never reads it. Actual authorization for this module is
     *  ACTIVE-membership-existence (view/scope) plus the actor's GLOBAL {@link UserRole} (mutation
     *  tier, via SecurityExpressions.COMPANY_EDIT/COMPANY_ARCHIVE on CompanyController) - roleCode
     *  is deliberately never consulted as a security decision input, so it can never silently act
     *  as a fictitious per-company security role that diverges from what's actually enforced. */
    @Enumerated(EnumType.STRING)
    @Column(name = "role_code", nullable = false, length = 20)
    private UserRole roleCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CompanyMembershipStatus status = CompanyMembershipStatus.ACTIVE;

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
    public CompanyMembershipStatus getStatus() { return status; }
    public void setStatus(CompanyMembershipStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
