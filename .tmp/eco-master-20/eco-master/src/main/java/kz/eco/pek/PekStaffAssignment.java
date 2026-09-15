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

import java.time.LocalDateTime;

/** Assignment of OUR staff (an internal ECOPROGRESS user account, never a client-role account -
 *  see {@link PekStaffAssignmentService#assign}) to a client company's PEK data, with an explicit
 *  {@link PekStaffTier} permission tier. This is the real source of truth for
 *  {@link PekAccessService}'s company-scope/permission resolution, replacing
 *  {@link PekCompanyMembership} in that role: that table conflated "which user may act on this
 *  company's PEK data" with the generic {@code UserRole} enum (so a membership's "role" was
 *  really just a copy of the account's global role, and nothing stopped assigning a CLIENT-role
 *  account, i.e. creating a phantom "client company employee" that this module never intended to
 *  model). {@link PekCompanyMembership} itself is left in place - unused by any access-control
 *  path in this module, but its historical rows and CRUD API keep working so nothing referencing
 *  it directly is silently broken - see V103 for the one-time backfill migration into this table. */
@Entity
@Table(name = "pek_staff_assignments", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pek_staff_assignment", columnNames = {"company_id", "user_id"})
})
public class PekStaffAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PekStaffTier tier = PekStaffTier.VIEWER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PekMembershipStatus status = PekMembershipStatus.ACTIVE;

    @Column(name = "assigned_by")
    private Long assignedBy;

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
    public PekStaffTier getTier() { return tier; }
    public void setTier(PekStaffTier tier) { this.tier = tier; }
    public PekMembershipStatus getStatus() { return status; }
    public void setStatus(PekMembershipStatus status) { this.status = status; }
    public Long getAssignedBy() { return assignedBy; }
    public void setAssignedBy(Long assignedBy) { this.assignedBy = assignedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
