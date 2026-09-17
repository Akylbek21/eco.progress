package kz.eco.signaturedoc;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Short-lived record created by prepare-signing and consumed exactly once by submitSignature. */
@Entity
@Table(name = "signature_document_signing_sessions")
public class SignatureDocumentSigningSession {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "document_version", nullable = false)
    private int documentVersion;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    public boolean isExpired() { return LocalDateTime.now().isAfter(expiresAt); }
    public boolean isConsumed() { return consumedAt != null; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public int getDocumentVersion() { return documentVersion; }
    public void setDocumentVersion(int documentVersion) { this.documentVersion = documentVersion; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getConsumedAt() { return consumedAt; }
    public void setConsumedAt(LocalDateTime consumedAt) { this.consumedAt = consumedAt; }
}
