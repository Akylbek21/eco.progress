package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Environmental permit (разрешение на эмиссии/природопользование) tied to an object (module spec
 *  Iteration 2). Optionally linked to a {@link PekProgram} - a program may only rely on a permit
 *  that is ACTIVE (see {@link PekPermitService#requireActive}), never an EXPIRED/REVOKED one, even
 *  if its date range would otherwise still cover today. */
@Entity
@Table(name = "pek_environmental_permits")
public class PekEnvironmentalPermit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "object_id", nullable = false)
    private Long objectId;

    @Column(nullable = false, length = 60)
    private String type;

    @Column(nullable = false, length = 100)
    private String number;

    @Column(name = "issued_at", nullable = false)
    private LocalDate issuedAt;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to", nullable = false)
    private LocalDate validTo;

    @Column(nullable = false, length = 255)
    private String authority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PekPermitStatus status = PekPermitStatus.ACTIVE;

    @Column(name = "file_id", length = 64)
    private String fileId;

    @Column(length = 1000)
    private String note;

    @Column(name = "pek_program_id")
    private Long pekProgramId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Version
    @Column(nullable = false)
    private Long version;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public Long getObjectId() { return objectId; }
    public void setObjectId(Long objectId) { this.objectId = objectId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public LocalDate getIssuedAt() { return issuedAt; }
    public void setIssuedAt(LocalDate issuedAt) { this.issuedAt = issuedAt; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate validTo) { this.validTo = validTo; }
    public String getAuthority() { return authority; }
    public void setAuthority(String authority) { this.authority = authority; }
    public PekPermitStatus getStatus() { return status; }
    public void setStatus(PekPermitStatus status) { this.status = status; }
    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Long getPekProgramId() { return pekProgramId; }
    public void setPekProgramId(Long pekProgramId) { this.pekProgramId = pekProgramId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
    public Long getVersion() { return version; }

    /** True at `on` if today falls within [validFrom, validTo] AND status is ACTIVE - a
     *  date-range-only check would wrongly call a REVOKED permit "active" just because nobody
     *  updated its validTo. */
    public boolean isActiveOn(LocalDate on) {
        return status == PekPermitStatus.ACTIVE
                && !on.isBefore(validFrom) && !on.isAfter(validTo);
    }
}
