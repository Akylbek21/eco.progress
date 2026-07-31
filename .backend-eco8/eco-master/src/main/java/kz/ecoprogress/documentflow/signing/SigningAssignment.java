package kz.ecoprogress.documentflow.signing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One person's assignment to sign, on one step of a route. Never stores a raw IIN - only
 * {@code signerIinHash} (SHA-256 hex of the normalized IIN), so this table alone can never leak a
 * signer's IIN even if the DB is compromised. Same for the raw invitation token: only
 * {@code invitationTokenHash} (SHA-256 hex) is stored - the raw token exists only in the
 * generated URL sent to the signer, never persisted, so a DB read can't be used to forge a
 * signing link. Token comparison relies on the hash's own high entropy (SHA-256 of a
 * cryptographically random token) rather than an extra constant-time compare, since a
 * hash-equality lookup here is already a keyed-by-hash DB query, not a byte-by-byte comparison
 * against attacker-controlled timing.
 */
@Entity
@Table(name = "document_flow_signing_assignments")
public class SigningAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "step_id", nullable = false)
    private Long stepId;

    @Enumerated(EnumType.STRING)
    @Column(name = "signer_type", nullable = false, length = 30)
    private SignerType signerType;

    /** Only set for ORGANIZATION_MEMBER assignments. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "signer_full_name", length = 255)
    private String signerFullName;

    /** SHA-256 hex of the normalized (digits-only) IIN - see class javadoc. Never the raw IIN. */
    @Column(name = "signer_iin_hash", length = 64)
    private String signerIinHash;

    @Column(name = "organization_name", length = 500)
    private String organizationName;

    @Column(name = "organization_bin", length = 20)
    private String organizationBin;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "role_code", length = 100)
    private String roleCode;

    @Column(name = "required", nullable = false)
    private boolean required = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private AssignmentStatus status = AssignmentStatus.PENDING;

    @Column(name = "available_at")
    private Instant availableAt;

    @Column(name = "viewed_at")
    private Instant viewedAt;

    @Column(name = "signed_at")
    private Instant signedAt;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejection_reason", length = 2000)
    private String rejectionReason;

    /** SHA-256 hex of the raw invitation token - see class javadoc. */
    @Column(name = "invitation_token_hash", length = 64)
    private String invitationTokenHash;

    @Column(name = "invitation_expires_at")
    private Instant invitationExpiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getStepId() { return stepId; }
    public void setStepId(Long stepId) { this.stepId = stepId; }
    public SignerType getSignerType() { return signerType; }
    public void setSignerType(SignerType signerType) { this.signerType = signerType; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSignerFullName() { return signerFullName; }
    public void setSignerFullName(String signerFullName) { this.signerFullName = signerFullName; }
    public String getSignerIinHash() { return signerIinHash; }
    public void setSignerIinHash(String signerIinHash) { this.signerIinHash = signerIinHash; }
    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }
    public String getOrganizationBin() { return organizationBin; }
    public void setOrganizationBin(String organizationBin) { this.organizationBin = organizationBin; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getRoleCode() { return roleCode; }
    public void setRoleCode(String roleCode) { this.roleCode = roleCode; }
    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public AssignmentStatus getStatus() { return status; }
    public void setStatus(AssignmentStatus status) { this.status = status; }
    public Instant getAvailableAt() { return availableAt; }
    public void setAvailableAt(Instant availableAt) { this.availableAt = availableAt; }
    public Instant getViewedAt() { return viewedAt; }
    public void setViewedAt(Instant viewedAt) { this.viewedAt = viewedAt; }
    public Instant getSignedAt() { return signedAt; }
    public void setSignedAt(Instant signedAt) { this.signedAt = signedAt; }
    public Instant getRejectedAt() { return rejectedAt; }
    public void setRejectedAt(Instant rejectedAt) { this.rejectedAt = rejectedAt; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public String getInvitationTokenHash() { return invitationTokenHash; }
    public void setInvitationTokenHash(String invitationTokenHash) { this.invitationTokenHash = invitationTokenHash; }
    public Instant getInvitationExpiresAt() { return invitationExpiresAt; }
    public void setInvitationExpiresAt(Instant invitationExpiresAt) { this.invitationExpiresAt = invitationExpiresAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
