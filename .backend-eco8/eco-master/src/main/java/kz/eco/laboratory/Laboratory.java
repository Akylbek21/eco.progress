package kz.eco.laboratory;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "laboratories")
public class Laboratory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(length = 300)
    private String legalName;

    @Column(length = 20)
    private String bin;

    @Column(length = 500)
    private String address;

    @Column(length = 64)
    private String phone;

    @Column(length = 255)
    private String email;

    @Column(length = 80)
    private String accreditationNumber;

    private LocalDate accreditationIssuedAt;
    private LocalDate accreditationValidUntil;

    private Long directorId;

    @Column(length = 200)
    private String directorName;

    private Long laboratoryHeadId;

    @Column(length = 200)
    private String laboratoryHeadName;

    @Column(length = 500)
    private String logoUrl;

    @Column(length = 64)
    private String logoFileId;

    @Column(columnDefinition = "TEXT")
    private String standardNote;

    @Column(nullable = false)
    private boolean isDefault = false;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLegalName() { return legalName; }
    public void setLegalName(String legalName) { this.legalName = legalName; }
    public String getBin() { return bin; }
    public void setBin(String bin) { this.bin = bin; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAccreditationNumber() { return accreditationNumber; }
    public void setAccreditationNumber(String accreditationNumber) { this.accreditationNumber = accreditationNumber; }
    public LocalDate getAccreditationIssuedAt() { return accreditationIssuedAt; }
    public void setAccreditationIssuedAt(LocalDate accreditationIssuedAt) { this.accreditationIssuedAt = accreditationIssuedAt; }
    public LocalDate getAccreditationValidUntil() { return accreditationValidUntil; }
    public void setAccreditationValidUntil(LocalDate accreditationValidUntil) { this.accreditationValidUntil = accreditationValidUntil; }
    public Long getDirectorId() { return directorId; }
    public void setDirectorId(Long directorId) { this.directorId = directorId; }
    public String getDirectorName() { return directorName; }
    public void setDirectorName(String directorName) { this.directorName = directorName; }
    public Long getLaboratoryHeadId() { return laboratoryHeadId; }
    public void setLaboratoryHeadId(Long laboratoryHeadId) { this.laboratoryHeadId = laboratoryHeadId; }
    public String getLaboratoryHeadName() { return laboratoryHeadName; }
    public void setLaboratoryHeadName(String laboratoryHeadName) { this.laboratoryHeadName = laboratoryHeadName; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getLogoFileId() { return logoFileId; }
    public void setLogoFileId(String logoFileId) { this.logoFileId = logoFileId; }
    public String getStandardNote() { return standardNote; }
    public void setStandardNote(String standardNote) { this.standardNote = standardNote; }
    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
