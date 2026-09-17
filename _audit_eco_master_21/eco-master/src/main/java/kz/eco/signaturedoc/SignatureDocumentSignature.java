package kz.eco.signaturedoc;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "signature_document_signatures")
public class SignatureDocumentSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "document_version", nullable = false)
    private int documentVersion;

    @Column(name = "signer_user_id", nullable = false)
    private Long signerUserId;

    @Column(name = "cms_storage_id", length = 64)
    private String cmsStorageId;

    @Column(name = "certificate_serial_number", length = 120)
    private String certificateSerialNumber;

    @Column(name = "certificate_subject", length = 500)
    private String certificateSubject;

    @Column(name = "certificate_issuer", length = 500)
    private String certificateIssuer;

    @Column(name = "certificate_iin", length = 20)
    private String certificateIin;

    @Column(name = "certificate_bin", length = 20)
    private String certificateBin;

    @Column(name = "certificate_valid_from")
    private LocalDate certificateValidFrom;

    @Column(name = "certificate_valid_to")
    private LocalDate certificateValidTo;

    @Column(name = "signature_algorithm", length = 60)
    private String signatureAlgorithm;

    @Column(name = "file_sha256", length = 64)
    private String fileSha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 30)
    private SignatureDocumentVerificationStatus verificationStatus;

    @Column(name = "verification_message", length = 1000)
    private String verificationMessage;

    /** Certificate hardening (module spec item 5) - outcome of each check, stored as the enum
     *  name (kz.eco.signature.verification.CertificateCheckStatus), nullable since older rows
     *  predate this feature. */
    @Column(name = "chain_status", length = 20)
    private String chainStatus;

    @Column(name = "crl_status", length = 20)
    private String crlStatus;

    @Column(name = "ocsp_status", length = 20)
    private String ocspStatus;

    @Column(name = "tsa_status", length = 20)
    private String tsaStatus;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public int getDocumentVersion() { return documentVersion; }
    public void setDocumentVersion(int documentVersion) { this.documentVersion = documentVersion; }
    public Long getSignerUserId() { return signerUserId; }
    public void setSignerUserId(Long signerUserId) { this.signerUserId = signerUserId; }
    public String getCmsStorageId() { return cmsStorageId; }
    public void setCmsStorageId(String cmsStorageId) { this.cmsStorageId = cmsStorageId; }
    public String getCertificateSerialNumber() { return certificateSerialNumber; }
    public void setCertificateSerialNumber(String certificateSerialNumber) { this.certificateSerialNumber = certificateSerialNumber; }
    public String getCertificateSubject() { return certificateSubject; }
    public void setCertificateSubject(String certificateSubject) { this.certificateSubject = certificateSubject; }
    public String getCertificateIssuer() { return certificateIssuer; }
    public void setCertificateIssuer(String certificateIssuer) { this.certificateIssuer = certificateIssuer; }
    public String getCertificateIin() { return certificateIin; }
    public void setCertificateIin(String certificateIin) { this.certificateIin = certificateIin; }
    public String getCertificateBin() { return certificateBin; }
    public void setCertificateBin(String certificateBin) { this.certificateBin = certificateBin; }
    public LocalDate getCertificateValidFrom() { return certificateValidFrom; }
    public void setCertificateValidFrom(LocalDate certificateValidFrom) { this.certificateValidFrom = certificateValidFrom; }
    public LocalDate getCertificateValidTo() { return certificateValidTo; }
    public void setCertificateValidTo(LocalDate certificateValidTo) { this.certificateValidTo = certificateValidTo; }
    public String getSignatureAlgorithm() { return signatureAlgorithm; }
    public void setSignatureAlgorithm(String signatureAlgorithm) { this.signatureAlgorithm = signatureAlgorithm; }
    public String getFileSha256() { return fileSha256; }
    public void setFileSha256(String fileSha256) { this.fileSha256 = fileSha256; }
    public SignatureDocumentVerificationStatus getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(SignatureDocumentVerificationStatus verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getVerificationMessage() { return verificationMessage; }
    public void setVerificationMessage(String verificationMessage) { this.verificationMessage = verificationMessage; }
    public String getChainStatus() { return chainStatus; }
    public void setChainStatus(String chainStatus) { this.chainStatus = chainStatus; }
    public String getCrlStatus() { return crlStatus; }
    public void setCrlStatus(String crlStatus) { this.crlStatus = crlStatus; }
    public String getOcspStatus() { return ocspStatus; }
    public void setOcspStatus(String ocspStatus) { this.ocspStatus = ocspStatus; }
    public String getTsaStatus() { return tsaStatus; }
    public void setTsaStatus(String tsaStatus) { this.tsaStatus = tsaStatus; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
