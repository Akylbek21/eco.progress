package kz.eco.pek;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Records a successful CMS signature over a specific {@link PekReportDocumentVersion} (Iteration 3
 * of the PEK module overhaul). Modeled as its own table rather than columns on PekReport, mirroring
 * the ProtocolSignature precedent - a signature refers to a specific document version and carries
 * its own certificate metadata. Raw CMS bytes are never stored here, only the FileStorageService
 * fileId (cmsFileId). A row is only ever inserted AFTER SignatureVerificationService#verifyDocument
 * succeeds - see PekReportSigningService#sign - so a persisted row always means "really verified".
 */
@Entity
@Table(name = "pek_report_signatures", indexes =
        @Index(name = "ix_pek_report_signatures_report_id", columnList = "report_id"))
public class PekReportSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "document_version_id", nullable = false)
    private Long documentVersionId;

    @Column(name = "signer_user_id", nullable = false)
    private Long signerUserId;

    @Column(name = "signed_at", nullable = false)
    private LocalDateTime signedAt = LocalDateTime.now();

    @Column(name = "document_hash", nullable = false, length = 64)
    private String documentHash;

    @Column(name = "signature_type", nullable = false, length = 30)
    private String signatureType = "CMS";

    @Column(name = "cms_file_id", nullable = false, length = 64)
    private String cmsFileId;

    @Column(name = "certificate_subject", length = 500)
    private String certificateSubject;

    @Column(name = "certificate_cn", length = 255)
    private String certificateCn;

    @Column(name = "certificate_serial", length = 100)
    private String certificateSerial;

    @Column(name = "certificate_organization", length = 255)
    private String certificateOrganization;

    @Column(nullable = false)
    private boolean verified;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long v) { reportId = v; }
    public Long getDocumentVersionId() { return documentVersionId; }
    public void setDocumentVersionId(Long v) { documentVersionId = v; }
    public Long getSignerUserId() { return signerUserId; }
    public void setSignerUserId(Long v) { signerUserId = v; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime v) { signedAt = v; }
    public String getDocumentHash() { return documentHash; }
    public void setDocumentHash(String v) { documentHash = v; }
    public String getSignatureType() { return signatureType; }
    public void setSignatureType(String v) { signatureType = v; }
    public String getCmsFileId() { return cmsFileId; }
    public void setCmsFileId(String v) { cmsFileId = v; }
    public String getCertificateSubject() { return certificateSubject; }
    public void setCertificateSubject(String v) { certificateSubject = v; }
    public String getCertificateCn() { return certificateCn; }
    public void setCertificateCn(String v) { certificateCn = v; }
    public String getCertificateSerial() { return certificateSerial; }
    public void setCertificateSerial(String v) { certificateSerial = v; }
    public String getCertificateOrganization() { return certificateOrganization; }
    public void setCertificateOrganization(String v) { certificateOrganization = v; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean v) { verified = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
