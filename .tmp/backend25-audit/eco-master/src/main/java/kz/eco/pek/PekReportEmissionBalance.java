package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Балансовые величины выброса одного вещества одним источником за отчётный период - the columns of
 * the official emissions table that no laboratory protocol measures.
 *
 * <p>A protocol gives the concentration and the mass emission (г/с) leaving the stack; it says
 * nothing about how much was generated before the gas cleaning, how much the cleaning captured and
 * how much of that was utilised, nor why an emission grew. Those come from the facility's own
 * accounting. They are kept separately from {@link PekReportResultRow}, which collect() rebuilds
 * from protocols on every run and would otherwise wipe them.
 */
@Entity
@Table(name = "pek_report_emission_balances",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_report_emission_balance",
                columnNames = {"report_id", "emission_source_id", "substance_code"}))
public class PekReportEmissionBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "emission_source_id", nullable = false)
    private Long emissionSourceId;

    /** Код загрязняющего вещества, matched against PekReportResultRow.indicatorCode. */
    @Column(name = "substance_code", nullable = false, length = 60)
    private String substanceCode;

    /** Выброс без учёта очистки, т за период. */
    @Column(name = "without_treatment_tons", precision = 18, scale = 6)
    private BigDecimal withoutTreatmentTons;

    /** Уловлено очистными установками, т за период. */
    @Column(name = "captured_tons", precision = 18, scale = 6)
    private BigDecimal capturedTons;

    /** Из уловленного утилизировано, т за период. */
    @Column(name = "utilized_tons", precision = 18, scale = 6)
    private BigDecimal utilizedTons;

    /** Причина увеличения выброса - required when the actual emission exceeds the normative. */
    @Column(name = "increase_reason", length = 2000)
    private String increaseReason;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long v) { reportId = v; }
    public Long getEmissionSourceId() { return emissionSourceId; }
    public void setEmissionSourceId(Long v) { emissionSourceId = v; }
    public String getSubstanceCode() { return substanceCode; }
    public void setSubstanceCode(String v) { substanceCode = v; }
    public BigDecimal getWithoutTreatmentTons() { return withoutTreatmentTons; }
    public void setWithoutTreatmentTons(BigDecimal v) { withoutTreatmentTons = v; }
    public BigDecimal getCapturedTons() { return capturedTons; }
    public void setCapturedTons(BigDecimal v) { capturedTons = v; }
    public BigDecimal getUtilizedTons() { return utilizedTons; }
    public void setUtilizedTons(BigDecimal v) { utilizedTons = v; }
    public String getIncreaseReason() { return increaseReason; }
    public void setIncreaseReason(String v) { increaseReason = v; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long v) { updatedBy = v; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v) { updatedAt = v; }
    public Long getVersion() { return version; }
}
