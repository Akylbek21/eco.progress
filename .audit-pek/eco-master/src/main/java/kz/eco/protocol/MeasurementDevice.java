package kz.eco.protocol;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "measurement_devices")
public class MeasurementDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 120)
    private String model;

    @Column(length = 80)
    private String serialNumber;

    @Column(length = 80)
    private String verificationCertificateNumber;

    private LocalDate verificationDate;
    private LocalDate verificationValidUntil;

    @Column(length = 120)
    private String units;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MeasurementDeviceStatus status = MeasurementDeviceStatus.VALID;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
        refreshStatus();
    }

    @PrePersist
    void onPersist() {
        refreshStatus();
    }

    public void refreshStatus() {
        if (status == MeasurementDeviceStatus.ARCHIVED) {
            return;
        }
        status = MeasurementDeviceStatus.resolve(verificationValidUntil);
    }

    public boolean isVerificationValid() {
        return status != MeasurementDeviceStatus.EXPIRED && status != MeasurementDeviceStatus.ARCHIVED;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
    public String getVerificationCertificateNumber() { return verificationCertificateNumber; }
    public void setVerificationCertificateNumber(String verificationCertificateNumber) { this.verificationCertificateNumber = verificationCertificateNumber; }
    public LocalDate getVerificationDate() { return verificationDate; }
    public void setVerificationDate(LocalDate verificationDate) { this.verificationDate = verificationDate; }
    public LocalDate getVerificationValidUntil() { return verificationValidUntil; }
    public void setVerificationValidUntil(LocalDate verificationValidUntil) { this.verificationValidUntil = verificationValidUntil; }
    public String getUnits() { return units; }
    public void setUnits(String units) { this.units = units; }
    public MeasurementDeviceStatus getStatus() { return status; }
    public void setStatus(MeasurementDeviceStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
