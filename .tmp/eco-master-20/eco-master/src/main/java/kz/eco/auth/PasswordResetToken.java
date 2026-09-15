package kz.eco.auth;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** One-time password setup/reset token - only the SHA-256 hash is ever persisted, mirroring
 *  kz.ecoprogress.documentflow.membership.MembershipInvitation. */
@Entity
@Table(name = "user_password_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_password_token", columnNames = "token_hash"))
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PasswordResetTokenPurpose purpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PasswordResetTokenStatus status = PasswordResetTokenStatus.PENDING;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public PasswordResetTokenPurpose getPurpose() { return purpose; }
    public void setPurpose(PasswordResetTokenPurpose purpose) { this.purpose = purpose; }
    public PasswordResetTokenStatus getStatus() { return status; }
    public void setStatus(PasswordResetTokenStatus status) { this.status = status; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUsedAt() { return usedAt; }
    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }
}
