package kz.eco.laboratory;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "laboratory_employees")
public class LaboratoryEmployee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long laboratoryId;

    private Long userId;

    @Column(nullable = false, length = 200)
    private String fullName;

    @Column(length = 120)
    private String position;

    @Column(length = 255)
    private String email;

    @Column(length = 60)
    private String role;

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 40)
    private String phone;

    @Column(length = 60)
    private String employeeNumber;

    @Column(length = 500)
    private String qualification;

    @Column(nullable = false)
    private boolean canExecuteMeasurements = false;

    @Column(nullable = false)
    private boolean canApproveProtocols = false;

    @Column(nullable = false)
    private boolean canSignProtocols = false;

    private LocalDateTime deactivatedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Deliberately left uninitialized (not e.g. `= 0L`): Spring Data's isNew() check for an
     *  entity with a non-primitive @Version field is "version == null", not "id == null" - a
     *  non-null default here would make every brand-new employee look "already persisted" and
     *  silently switch save() from persist() to merge(), losing the generated id on the caller's
     *  object (see the identical issue already fixed on kz.eco.protocol.Protocol.version). */
    @Version
    @Column(nullable = false)
    private Long version;

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getLaboratoryId() { return laboratoryId; }
    public void setLaboratoryId(Long laboratoryId) { this.laboratoryId = laboratoryId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }
    public String getQualification() { return qualification; }
    public void setQualification(String qualification) { this.qualification = qualification; }
    public boolean isCanExecuteMeasurements() { return canExecuteMeasurements; }
    public void setCanExecuteMeasurements(boolean canExecuteMeasurements) { this.canExecuteMeasurements = canExecuteMeasurements; }
    public boolean isCanApproveProtocols() { return canApproveProtocols; }
    public void setCanApproveProtocols(boolean canApproveProtocols) { this.canApproveProtocols = canApproveProtocols; }
    public boolean isCanSignProtocols() { return canSignProtocols; }
    public void setCanSignProtocols(boolean canSignProtocols) { this.canSignProtocols = canSignProtocols; }
    public LocalDateTime getDeactivatedAt() { return deactivatedAt; }
    public void setDeactivatedAt(LocalDateTime deactivatedAt) { this.deactivatedAt = deactivatedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
