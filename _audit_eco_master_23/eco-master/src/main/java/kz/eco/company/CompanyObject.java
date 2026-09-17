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

    @Column(name = "object_type", length = 255)
    private String objectType;

    @Column(name = "region", length = 255)
    private String region;

    @Column(name = "city_district", length = 255)
    private String cityDistrict;

    @Column(name = "contact_person", length = 255)
    private String contactPerson;

    @Column(name = "contact_phone", length = 64)
    private String contactPhone;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "ACTIVE";

    /** Special monitoring regime this facility falls under, which changes its statutory reporting
     *  deadline. Explicit and per-facility - see {@link SpecialMonitoringType} for why it is
     *  neither inferred from coordinates nor held on the company. */
    @Enumerated(EnumType.STRING)
    @Column(name = "special_monitoring_type", nullable = false, length = 40)
    private SpecialMonitoringType specialMonitoringType = SpecialMonitoringType.NONE;

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

    /** P0 module fix item 8: optimistic locking - was entirely absent. */
    @Version
    @Column(nullable = false)
    private Long version;

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
    public String getObjectType() { return objectType; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getCityDistrict() { return cityDistrict; }
    public void setCityDistrict(String cityDistrict) { this.cityDistrict = cityDistrict; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public SpecialMonitoringType getSpecialMonitoringType() { return specialMonitoringType; }
    public void setSpecialMonitoringType(SpecialMonitoringType v) {
        this.specialMonitoringType = v == null ? SpecialMonitoringType.NONE : v;
    }
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
    public Long getVersion() { return version; }
}
