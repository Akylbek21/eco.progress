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
 * A stationary air-emission source declared by a PEK program (труба, вентшахта, неорганизованный
 * источник).
 *
 * <p>Previously this had no model of its own: a source existed only as a bare
 * {@code emissionSourceId} on {@link PekProgramControlItem}, pointing at nothing. That is enough to
 * say "this control item concerns some source", and not enough to fill an air-emissions table,
 * which needs the source's own physical description - height, diameter, cleaning equipment and its
 * efficiency, operating hours - none of which a generic control item has anywhere to put.
 *
 * <p>Scoped to the program, not to the report: the source inventory is part of what the program
 * declares, and a report covering a period reports movements/measurements against it.
 */
@Entity
@Table(name = "pek_emission_sources")
public class PekEmissionSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    /** Source number as it appears in the permit / inventory (e.g. "0001"). */
    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    /** ORGANIZED / UNORGANIZED - kept as free text rather than an enum because inventories in the
     *  wild carry wordings this module has no business rejecting. */
    @Column(name = "source_type", length = 60)
    private String sourceType;

    /** Workshop / production site the source belongs to. */
    @Column(name = "workshop_name", length = 255)
    private String workshopName;

    @Column(name = "height_m", precision = 12, scale = 3)
    private BigDecimal heightM;

    @Column(name = "diameter_m", precision = 12, scale = 3)
    private BigDecimal diameterM;

    @Column(length = 120)
    private String coordinates;

    @Column(name = "gas_cleaning_equipment", length = 500)
    private String gasCleaningEquipment;

    @Column(name = "cleaning_efficiency_percent", precision = 6, scale = 3)
    private BigDecimal cleaningEfficiencyPercent;

    @Column(name = "operating_hours_per_year")
    private Integer operatingHoursPerYear;

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
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getWorkshopName() { return workshopName; }
    public void setWorkshopName(String workshopName) { this.workshopName = workshopName; }
    public BigDecimal getHeightM() { return heightM; }
    public void setHeightM(BigDecimal heightM) { this.heightM = heightM; }
    public BigDecimal getDiameterM() { return diameterM; }
    public void setDiameterM(BigDecimal diameterM) { this.diameterM = diameterM; }
    public String getCoordinates() { return coordinates; }
    public void setCoordinates(String coordinates) { this.coordinates = coordinates; }
    public String getGasCleaningEquipment() { return gasCleaningEquipment; }
    public void setGasCleaningEquipment(String v) { this.gasCleaningEquipment = v; }
    public BigDecimal getCleaningEfficiencyPercent() { return cleaningEfficiencyPercent; }
    public void setCleaningEfficiencyPercent(BigDecimal v) { this.cleaningEfficiencyPercent = v; }
    public Integer getOperatingHoursPerYear() { return operatingHoursPerYear; }
    public void setOperatingHoursPerYear(Integer v) { this.operatingHoursPerYear = v; }
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
