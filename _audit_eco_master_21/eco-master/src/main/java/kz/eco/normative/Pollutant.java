package kz.eco.normative;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pollutants", indexes = {
        @Index(name = "idx_pollutant_code", columnList = "code")
})
public class Pollutant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(length = 300)
    private String nameRu;

    @Column(length = 300)
    private String nameKz;

    @Column(length = 500)
    private String aliases;

    @Column(length = 40)
    private String casNumber;

    @Column(length = 80)
    private String chemicalFormula;

    @Column(length = 10)
    private String hazardClass;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameRu() { return nameRu; }
    public void setNameRu(String nameRu) { this.nameRu = nameRu; }
    public String getNameKz() { return nameKz; }
    public void setNameKz(String nameKz) { this.nameKz = nameKz; }
    public String getAliases() { return aliases; }
    public void setAliases(String aliases) { this.aliases = aliases; }
    public String getCasNumber() { return casNumber; }
    public void setCasNumber(String casNumber) { this.casNumber = casNumber; }
    public String getChemicalFormula() { return chemicalFormula; }
    public void setChemicalFormula(String chemicalFormula) { this.chemicalFormula = chemicalFormula; }
    public String getHazardClass() { return hazardClass; }
    public void setHazardClass(String hazardClass) { this.hazardClass = hazardClass; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
