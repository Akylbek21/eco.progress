package kz.eco.company;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "company_objects")
public class CompanyObject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "address", length = 500)
    private String address;

    @Column(name = "activity_type", length = 255)
    private String activityType;

    @Column(name = "sampling_location", length = 500)
    private String samplingLocation;

    @Column(name = "coordinates", length = 100)
    private String coordinates;

    @Column(name = "sanitary_zone", length = 200)
    private String sanitaryZone;

    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "ACTIVE";

    /** Exactly one primary object per company is enforced by ux_company_objects_primary (a
     *  MySQL-safe emulation of a partial unique index - see the migration). */
    @Column(name = "is_primary", nullable = false)
    private boolean primary = false;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "archived_by")
    private Long archivedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getActivityType() { return activityType; }
    public void setActivityType(String activityType) { this.activityType = activityType; }
    public String getSamplingLocation() { return samplingLocation; }
    public void setSamplingLocation(String samplingLocation) { this.samplingLocation = samplingLocation; }
    public String getCoordinates() { return coordinates; }
    public void setCoordinates(String coordinates) { this.coordinates = coordinates; }
    public String getSanitaryZone() { return sanitaryZone; }
    public void setSanitaryZone(String sanitaryZone) { this.sanitaryZone = sanitaryZone; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isPrimary() { return primary; }
    public void setPrimary(boolean primary) { this.primary = primary; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }
    public Long getArchivedBy() { return archivedBy; }
    public void setArchivedBy(Long archivedBy) { this.archivedBy = archivedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
