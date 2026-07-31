package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A single link between a {@code pek_reports} row and a {@code lab_protocols} row (optionally
 * narrowed to one {@code protocol_results} row) - the replacement for the old design of a single
 * nullable {@code pek_report_id} FK column directly on Protocol. That design could never let one
 * protocol belong to a quarterly report AND a yearly report AND a later corrective revision at the
 * same time, since a column on Protocol can only ever point at one report. A join row per
 * (report, protocol[, result]) has no such ceiling.
 *
 * <p>{@code protocolResultId} is null for a "whole protocol matched" link, which is the only kind
 * {@link PekReportCollectionService} produces today - result-level matching (e.g. one exceeded
 * indicator inside a multi-result protocol driving normative-compliance checks) is real, reachable
 * data via {@code kz.eco.protocol.ProtocolResult}, but wiring per-result matching logic is out of
 * scope for this pass; the column exists so that finer-grained linking can be added later without
 * another migration.
 *
 * <p>The original unique constraint below was DB-level protection against exact duplicate rows,
 * but MySQL treats each NULL in a unique index as distinct from every other NULL - so it alone
 * would happily allow more than one (report_id, protocol_id, NULL) row if two whole-protocol links
 * were inserted concurrently. V56 added a real generated-column-backed unique index
 * (uk_pek_report_protocol_source_real, on protocolResultKey below) that collapses NULL to 0 so the
 * database itself now rejects true duplicates; {@link PekReportCollectionService#collect} still
 * checks {@link PekReportProtocolSourceRepository#existsByReportIdAndProtocolIdAndProtocolResultIdIsNull}
 * first (cheap, avoids a round-trip exception in the common case) and now also catches
 * {@code DataIntegrityViolationException} around the insert as the real race-safe fallback.
 */
@Entity
@Table(name = "pek_report_protocol_sources", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pek_report_protocol_source",
                columnNames = {"report_id", "protocol_id", "protocol_result_id"})
})
public class PekReportProtocolSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    /** Denormalized from the report's programId at insert time (module spec §5) - lets plan/fact
     *  and program-scoped queries avoid joining through pek_reports. */
    @Column(name = "program_id")
    private Long programId;

    @Column(name = "protocol_id", nullable = false)
    private Long protocolId;

    /** Null means "whole protocol matched"; non-null narrows the link to one specific
     *  ProtocolResult row - see class javadoc. */
    @Column(name = "protocol_result_id")
    private Long protocolResultId;

    /** Which {@link PekProgramControlItem} this link satisfies - required input to plan/fact
     *  (module spec §11); null for links created before control items existed or where automatic
     *  matching couldn't determine one (see PekMatchStatus.MANUAL / a future UNMATCHED flow). */
    @Column(name = "control_item_id")
    private Long controlItemId;

    /** Soft link, no ControlEvent entity exists in this codebase yet - reserved column, same
     *  convention as Protocol's pekControlEventId. */
    @Column(name = "control_event_id")
    private Long controlEventId;

    @Column(name = "monitoring_point_id")
    private Long monitoringPointId;

    @Column(name = "emission_source_id")
    private Long emissionSourceId;

    @Column(name = "water_outlet_id")
    private Long waterOutletId;

    @Column(name = "waste_source_id")
    private Long wasteSourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "match_status", nullable = false, length = 20)
    private PekMatchStatus matchStatus = PekMatchStatus.MATCHED;

    /** AUTO (produced by {@link PekReportCollectionService#collect}) vs MANUAL (a human picked
     *  this link explicitly, e.g. resolving an UNMATCHED source - module spec §14). Distinct from
     *  matchStatus: a MANUAL match_type row still has matchStatus MATCHED once confirmed. */
    @Column(name = "match_type", nullable = false, length = 20)
    private String matchType = "AUTO";

    @Column(name = "match_score", precision = 5, scale = 2)
    private BigDecimal matchScore;

    @Column(name = "matched_by")
    private Long matchedBy;

    /** The linked Protocol's @Version at match time - lets a later reconciliation pass detect that
     *  the protocol changed after this link was made (module spec §10.1 "учитывать версию
     *  источника") without needing to diff full content. */
    @Column(name = "source_version")
    private Long sourceVersion;

    @Column(name = "source_value", length = 255)
    private String sourceValue;

    @Column(name = "normalized_value", length = 255)
    private String normalizedValue;

    @Column(nullable = false)
    private boolean manual = false;

    @Column(nullable = false)
    private boolean excluded = false;

    @Column(name = "exclusion_reason", length = 500)
    private String exclusionReason;

    @Column(name = "matched_at")
    private LocalDateTime matchedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public Long getProtocolResultId() { return protocolResultId; }
    public void setProtocolResultId(Long protocolResultId) { this.protocolResultId = protocolResultId; }
    public Long getControlItemId() { return controlItemId; }
    public void setControlItemId(Long controlItemId) { this.controlItemId = controlItemId; }
    public Long getControlEventId() { return controlEventId; }
    public void setControlEventId(Long controlEventId) { this.controlEventId = controlEventId; }
    public Long getMonitoringPointId() { return monitoringPointId; }
    public void setMonitoringPointId(Long monitoringPointId) { this.monitoringPointId = monitoringPointId; }
    public Long getEmissionSourceId() { return emissionSourceId; }
    public void setEmissionSourceId(Long emissionSourceId) { this.emissionSourceId = emissionSourceId; }
    public Long getWaterOutletId() { return waterOutletId; }
    public void setWaterOutletId(Long waterOutletId) { this.waterOutletId = waterOutletId; }
    public Long getWasteSourceId() { return wasteSourceId; }
    public void setWasteSourceId(Long wasteSourceId) { this.wasteSourceId = wasteSourceId; }
    public PekMatchStatus getMatchStatus() { return matchStatus; }
    public void setMatchStatus(PekMatchStatus matchStatus) { this.matchStatus = matchStatus; }
    public String getMatchType() { return matchType; }
    public void setMatchType(String matchType) { this.matchType = matchType; }
    public BigDecimal getMatchScore() { return matchScore; }
    public void setMatchScore(BigDecimal matchScore) { this.matchScore = matchScore; }
    public Long getMatchedBy() { return matchedBy; }
    public void setMatchedBy(Long matchedBy) { this.matchedBy = matchedBy; }
    public Long getSourceVersion() { return sourceVersion; }
    public void setSourceVersion(Long sourceVersion) { this.sourceVersion = sourceVersion; }
    public Long getVersion() { return version; }
    public String getSourceValue() { return sourceValue; }
    public void setSourceValue(String sourceValue) { this.sourceValue = sourceValue; }
    public String getNormalizedValue() { return normalizedValue; }
    public void setNormalizedValue(String normalizedValue) { this.normalizedValue = normalizedValue; }
    public boolean isManual() { return manual; }
    public void setManual(boolean manual) { this.manual = manual; }
    public boolean isExcluded() { return excluded; }
    public void setExcluded(boolean excluded) { this.excluded = excluded; }
    public String getExclusionReason() { return exclusionReason; }
    public void setExclusionReason(String exclusionReason) { this.exclusionReason = exclusionReason; }
    public LocalDateTime getMatchedAt() { return matchedAt; }
    public void setMatchedAt(LocalDateTime matchedAt) { this.matchedAt = matchedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

