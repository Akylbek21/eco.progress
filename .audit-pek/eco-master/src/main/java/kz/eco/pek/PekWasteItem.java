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
 * One waste type the program declares, with the accumulation terms that apply to it: вид, код,
 * класс опасности, лимит накопления, срок накопления, площадка и её координаты.
 *
 * <p>Deliberately split from the period figures. What a program declares about a waste type (its
 * code, hazard class, accumulation limit and permitted accumulation period) is stable and belongs
 * to the program; how much of it was on hand, generated, and transferred during one reporting
 * period is a fact about that period and lives in {@link PekReportWasteMovement}. Folding both into
 * one row would mean either rewriting program data every quarter or duplicating the catalogue per
 * report.
 *
 * <p>Before this, waste existed only as a {@code wasteSourceId} on {@link PekProgramControlItem}
 * pointing at nothing, so none of the above could be recorded at all.
 */
@Entity
@Table(name = "pek_waste_items")
public class PekWasteItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    /** Waste type name (вид отхода). */
    @Column(nullable = false, length = 500)
    private String name;

    /** Classifier code for the waste type. */
    @Column(length = 60)
    private String code;

    /** Hazard class, free text: wordings differ between classifiers and this module is not the
     *  right place to reject one. */
    @Column(name = "hazard_class", length = 60)
    private String hazardClass;

    /** Permitted accumulation limit, in {@link #limitUnit}. */
    @Column(name = "accumulation_limit", precision = 18, scale = 4)
    private BigDecimal accumulationLimit;

    @Column(name = "limit_unit", length = 40)
    private String limitUnit;

    /** Permitted accumulation period (срок накопления), in days. */
    @Column(name = "accumulation_period_days")
    private Integer accumulationPeriodDays;

    @Column(name = "storage_site_name", length = 255)
    private String storageSiteName;

    @Column(length = 120)
    private String coordinates;

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
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getHazardClass() { return hazardClass; }
    public void setHazardClass(String hazardClass) { this.hazardClass = hazardClass; }
    public BigDecimal getAccumulationLimit() { return accumulationLimit; }
    public void setAccumulationLimit(BigDecimal v) { this.accumulationLimit = v; }
    public String getLimitUnit() { return limitUnit; }
    public void setLimitUnit(String limitUnit) { this.limitUnit = limitUnit; }
    public Integer getAccumulationPeriodDays() { return accumulationPeriodDays; }
    public void setAccumulationPeriodDays(Integer v) { this.accumulationPeriodDays = v; }
    public String getStorageSiteName() { return storageSiteName; }
    public void setStorageSiteName(String storageSiteName) { this.storageSiteName = storageSiteName; }
    public String getCoordinates() { return coordinates; }
    public void setCoordinates(String coordinates) { this.coordinates = coordinates; }
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
