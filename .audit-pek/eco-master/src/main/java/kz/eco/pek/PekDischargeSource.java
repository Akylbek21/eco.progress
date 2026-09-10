package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A wastewater discharge outlet (выпуск сточных вод) declared by a PEK program.
 *
 * <p>The counterpart of {@link PekEmissionSource} for the water component: previously an outlet
 * existed only as a bare {@code waterOutletId} on {@link PekProgramControlItem} referencing
 * nothing, so the receiving water body, the permitted discharge volume and the treatment
 * facilities had nowhere to live.
 */
@Entity
@Table(name = "pek_discharge_sources")
public class PekDischargeSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    /** Outlet number as it appears in the permit (e.g. "В-1"). */
    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    /** Water body or terrain the outlet discharges into. */
    @Column(name = "receiving_water_body", length = 255)
    private String receivingWaterBody;

    /** Category of discharge (хозяйственно-бытовые, производственные, ливневые, ...). */
    @Column(name = "discharge_type", length = 120)
    private String dischargeType;

    @Column(length = 120)
    private String coordinates;

    /** Permitted discharge volume for the period, in {@link #volumeUnit}. */
    @Column(name = "permitted_volume", precision = 18, scale = 4)
    private BigDecimal permittedVolume;

    @Column(name = "volume_unit", length = 40)
    private String volumeUnit;

    @Column(name = "treatment_facilities", length = 500)
    private String treatmentFacilities;

    @Column(length = 2000)
    private String description;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getReceivingWaterBody() { return receivingWaterBody; }
    public void setReceivingWaterBody(String v) { this.receivingWaterBody = v; }
    public String getDischargeType() { return dischargeType; }
    public void setDischargeType(String dischargeType) { this.dischargeType = dischargeType; }
    public String getCoordinates() { return coordinates; }
    public void setCoordinates(String coordinates) { this.coordinates = coordinates; }
    public BigDecimal getPermittedVolume() { return permittedVolume; }
    public void setPermittedVolume(BigDecimal permittedVolume) { this.permittedVolume = permittedVolume; }
    public String getVolumeUnit() { return volumeUnit; }
    public void setVolumeUnit(String volumeUnit) { this.volumeUnit = volumeUnit; }
    public String getTreatmentFacilities() { return treatmentFacilities; }
    public void setTreatmentFacilities(String v) { this.treatmentFacilities = v; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
