package kz.eco.company;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "companies", indexes = {
        @Index(name = "idx_companies_name", columnList = "name"),
        @Index(name = "idx_companies_bin", columnList = "bin"),
        @Index(name = "idx_companies_status", columnList = "status")
})
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 32)
    private String bin;

    @Column(length = 500)
    private String legalAddress;

    @Column(length = 500)
    private String actualAddress;

    @Column(length = 64)
    private String phone;

    @Column(length = 255)
    private String email;

    @Column(length = 1000)
    private String comment;

    @Column(length = 1000)
    private String notes;

    @Column(length = 255)
    private String directorName;

    @Column(length = 255)
    private String directorPosition;

    @Column(length = 255)
    private String responsiblePerson;

    @Column(length = 64)
    private String responsiblePersonPhone;

    @Column(length = 255)
    private String bankName;

    @Column(length = 64)
    private String iban;

    @Column(length = 64)
    private String bik;

    @Column(length = 32)
    private String kbe;

    @Column(length = 32)
    private String knp;

    @Column(length = 128)
    private String contractNumber;

    private LocalDate contractDate;

    @Column(length = 255)
    private String objectName;

    @Column(length = 500)
    private String objectAddress;

    @Column(length = 255)
    private String activityType;

    @Column(length = 500)
    private String samplingLocation;

    @Column(length = 255)
    private String customerRepresentative;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CompanyStatus status = CompanyStatus.ACTIVE;

    private LocalDateTime archivedAt;

    private Long archivedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

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
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBin() { return bin; }
    public void setBin(String bin) { this.bin = bin; }
    public String getLegalAddress() { return legalAddress; }
    public void setLegalAddress(String legalAddress) { this.legalAddress = legalAddress; }
    public String getActualAddress() { return actualAddress; }
    public void setActualAddress(String actualAddress) { this.actualAddress = actualAddress; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getDirectorName() { return directorName; }
    public void setDirectorName(String directorName) { this.directorName = directorName; }
    public String getDirectorPosition() { return directorPosition; }
    public void setDirectorPosition(String directorPosition) { this.directorPosition = directorPosition; }
    public String getResponsiblePerson() { return responsiblePerson; }
    public void setResponsiblePerson(String responsiblePerson) { this.responsiblePerson = responsiblePerson; }
    public String getResponsiblePersonPhone() { return responsiblePersonPhone; }
    public void setResponsiblePersonPhone(String responsiblePersonPhone) { this.responsiblePersonPhone = responsiblePersonPhone; }
    public String getBankName() { return bankName; }
    public void setBankName(String bankName) { this.bankName = bankName; }
    public String getIban() { return iban; }
    public void setIban(String iban) { this.iban = iban; }
    public String getBik() { return bik; }
    public void setBik(String bik) { this.bik = bik; }
    public String getKbe() { return kbe; }
    public void setKbe(String kbe) { this.kbe = kbe; }
    public String getKnp() { return knp; }
    public void setKnp(String knp) { this.knp = knp; }
    public String getContractNumber() { return contractNumber; }
    public void setContractNumber(String contractNumber) { this.contractNumber = contractNumber; }
    public LocalDate getContractDate() { return contractDate; }
    public void setContractDate(LocalDate contractDate) { this.contractDate = contractDate; }
    public String getObjectName() { return objectName; }
    public void setObjectName(String objectName) { this.objectName = objectName; }
    public String getObjectAddress() { return objectAddress; }
    public void setObjectAddress(String objectAddress) { this.objectAddress = objectAddress; }
    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }
    public String getSamplingLocation() { return samplingLocation; }
    public void setSamplingLocation(String samplingLocation) { this.samplingLocation = samplingLocation; }
    public String getCustomerRepresentative() { return customerRepresentative; }
    public void setCustomerRepresentative(String customerRepresentative) { this.customerRepresentative = customerRepresentative; }
    public CompanyStatus getStatus() { return status; }
    public void setStatus(CompanyStatus status) { this.status = status; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }
    public Long getArchivedBy() { return archivedBy; }
    public void setArchivedBy(Long archivedBy) { this.archivedBy = archivedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
