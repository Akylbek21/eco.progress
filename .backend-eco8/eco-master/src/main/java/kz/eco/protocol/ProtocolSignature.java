package kz.eco.protocol;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * One employee's signature on one version of a protocol. Multiple rows can exist for the same
 * (protocolId, protocolVersion) - up to ProtocolSigningProperties.maxSignatures - one per userId.
 * The FIRST signature for a version is also what flips Protocol.status DRAFT-chain -> SIGNED and
 * populates the legacy Protocol.signedBy/signedAt/pdfSha256 fields (kept for backward
 * compatibility, see ProtocolService#sign); every signature after that leaves status untouched.
 */
@Entity
@Table(name = "protocol_signatures", uniqueConstraints = {
        @UniqueConstraint(name = "uk_protocol_signatures_user_version",
                columnNames = {"protocol_id", "protocol_version", "user_id"})
})
public class ProtocolSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "protocol_id", nullable = false)
    private Long protocolId;

    @Column(name = "protocol_version", nullable = false)
    private Long protocolVersion;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "signer_full_name", nullable = false, length = 255)
    private String signerFullName;

    @Column(name = "signer_position", length = 255)
    private String signerPosition;

    @Column(name = "pdf_sha256", nullable = false, length = 64)
    private String pdfSha256;

    @Column(name = "signed_at", nullable = false)
    private Instant signedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Long getProtocolVersion() { return protocolVersion; }
    public void setProtocolVersion(Long protocolVersion) { this.protocolVersion = protocolVersion; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSignerFullName() { return signerFullName; }
    public void setSignerFullName(String signerFullName) { this.signerFullName = signerFullName; }
    public String getSignerPosition() { return signerPosition; }
    public void setSignerPosition(String signerPosition) { this.signerPosition = signerPosition; }
    public String getPdfSha256() { return pdfSha256; }
    public void setPdfSha256(String pdfSha256) { this.pdfSha256 = pdfSha256; }
    public Instant getSignedAt() { return signedAt; }
    public void setSignedAt(Instant signedAt) { this.signedAt = signedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
