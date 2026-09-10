package kz.ecoprogress.documentflow.signing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One completed signature on one document version. Mirrors kz.eco.protocol.ProtocolSignature's
 * "N different people each sign the same immutable content once" pattern: uniqueness is enforced
 * by DB constraint (assignment_id) - not just an existsBy pre-check - so a genuine double-click
 * race is caught as a clean 409 by translating the resulting DataIntegrityViolationException,
 * never left to surface as a raw 500. (request_id) is separately unique for idempotent retries of
 * the *same* client request.
 *
 * verificationStatus must never be written VALID unless every check genuinely passed (signature
 * cryptographically valid over the exact document bytes, certificate currently within its
 * validity window, and - to the extent checked - not revoked). trustedTimestamp is left null: a
 * real TSA (timestamp authority) call is out of scope for this pass, so no signature here carries
 * a qualified trusted timestamp - known limitation, not a bug.
 */
@Entity
@Table(name = "document_flow_signatures", uniqueConstraints = {
        @UniqueConstraint(name = "uk_document_flow_signatures_assignment", columnNames = {"assignment_id"}),
        @UniqueConstraint(name = "uk_document_flow_signatures_request", columnNames = {"request_id"})
})
public class DocumentFlowSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "document_version_id", nullable = false)
    private Long documentVersionId;

    @Column(name = "route_id", nullable = false)
    private Long routeId;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    /** Nullable: only populated for ORGANIZATION_MEMBER signers. */
    @Column(name = "signer_user_id")
    private Long signerUserId;

    @Column(name = "cms_storage_key", nullable = false, length = 255)
    private String cmsStorageKey;

    @Column(name = "cms_hash", nullable = false, length = 64)
    private String cmsHash;

    @Column(name = "certificate_serial_number", length = 128)
    private String certificateSerialNumber;

    @Column(name = "certificate_subject", length = 1000)
    private String certificateSubject;

    @Column(name = "certificate_issuer", length = 1000)
    private String certificateIssuer;

    /** SHA-256 hex of the signer's normalized IIN extracted from the certificate - never the raw
     *  IIN (matches SigningAssignment.signerIinHash convention). */
    @Column(name = "certificate_iin_hash", length = 64)
    private String certificateIinHash;

    @Column(name = "certificate_bin", length = 20)
    private String certificateBin;

    @Column(name = "certificate_valid_from")
    private LocalDate certificateValidFrom;

    @Column(name = "certificate_valid_to")
    private LocalDate certificateValidTo;

    @Column(name = "signed_at", nullable = false)
    private Instant signedAt;

    /** Always null in this pass - see class javadoc (no TSA integration yet). */
    @Column(name = "trusted_timestamp")
    private Instant trustedTimestamp;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 30)
    private VerificationStatus verificationStatus;

    @Column(name = "verification_details_json", columnDefinition = "TEXT")
    private String verificationDetailsJson;

    @Column(name = "request_id", nullable = false, length = 255)
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public Long getDocumentVersionId() { return documentVersionId; }
    public void setDocumentVersionId(Long documentVersionId) { this.documentVersionId = documentVersionId; }
    public Long getRouteId() { return routeId; }
    public void setRouteId(Long routeId) { this.routeId = routeId; }
    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }
    public Long getSignerUserId() { return signerUserId; }
    public void setSignerUserId(Long signerUserId) { this.signerUserId = signerUserId; }
    public String getCmsStorageKey() { return cmsStorageKey; }
    public void setCmsStorageKey(String cmsStorageKey) { this.cmsStorageKey = cmsStorageKey; }
    public String getCmsHash() { return cmsHash; }
    public void setCmsHash(String cmsHash) { this.cmsHash = cmsHash; }
    public String getCertificateSerialNumber() { return certificateSerialNumber; }
    public void setCertificateSerialNumber(String certificateSerialNumber) { this.certificateSerialNumber = certificateSerialNumber; }
    public String getCertificateSubject() { return certificateSubject; }
    public void setCertificateSubject(String certificateSubject) { this.certificateSubject = certificateSubject; }
    public String getCertificateIssuer() { return certificateIssuer; }
    public void setCertificateIssuer(String certificateIssuer) { this.certificateIssuer = certificateIssuer; }
    public String getCertificateIinHash() { return certificateIinHash; }
    public void setCertificateIinHash(String certificateIinHash) { this.certificateIinHash = certificateIinHash; }
    public String getCertificateBin() { return certificateBin; }
    public void setCertificateBin(String certificateBin) { this.certificateBin = certificateBin; }
    public LocalDate getCertificateValidFrom() { return certificateValidFrom; }
    public void setCertificateValidFrom(LocalDate certificateValidFrom) { this.certificateValidFrom = certificateValidFrom; }
    public LocalDate getCertificateValidTo() { return certificateValidTo; }
    public void setCertificateValidTo(LocalDate certificateValidTo) { this.certificateValidTo = certificateValidTo; }
    public Instant getSignedAt() { return signedAt; }
    public void setSignedAt(Instant signedAt) { this.signedAt = signedAt; }
    public Instant getTrustedTimestamp() { return trustedTimestamp; }
    public void setTrustedTimestamp(Instant trustedTimestamp) { this.trustedTimestamp = trustedTimestamp; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(VerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getVerificationDetailsJson() { return verificationDetailsJson; }
    public void setVerificationDetailsJson(String verificationDetailsJson) { this.verificationDetailsJson = verificationDetailsJson; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
