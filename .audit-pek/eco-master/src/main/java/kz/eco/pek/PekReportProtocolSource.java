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
 * <b>THE canonical protocol&lt;-&gt;PEK link ("ProtocolPekLink").</b> There is exactly ONE link model
 * in this codebase and it is this entity/table ({@code pek_report_protocol_sources}). Everything
 * that needs to know which PEK program / control item / program indicator / monitoring point a
 * lab protocol satisfies reads it from here:
 * <ul>
 *   <li>{@link PekProtocolLinkService} - protocol-initiated linking (POST /api/protocols/{id}/pek-links,
 *       and the {@code pekContext} block of protocol draft creation);</li>
 *   <li>{@link kz.eco.protocol.ProtocolPekCreationService} - "create protocol from ПЭК"
 *       (POST /api/protocols/from-pek), which always writes exactly one row here;</li>
 *   <li>{@link PekReportCollectionService} / {@link PekAutoCollectionService} - automatic
 *       report-time collection;</li>
 *   <li>{@link PekPlanFactService} - plan/fact and exceedance aggregation.</li>
 * </ul>
 * The nullable {@code pekProgramId}/{@code pekReportId}/{@code pekControlItemId}/
 * {@code pekControlEventId} columns still present on {@link kz.eco.protocol.Protocol} are a legacy
 * denormalized convenience only - they are NEVER the source of truth and must not be used to build
 * a second, competing link model. Do not introduce another link entity: extend this one.
 *
 * <p>A single link between a {@code pek_reports} row and a {@code lab_protocols} row (optionally
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

    /** Nullable since V74: a protocol-initiated link (created from ПЭК before any pek_reports row
     *  exists for the period) legitimately has no report yet; report-time collection fills it in.
     *  The entity previously declared {@code nullable = false}, which contradicted the migration
     *  and made every generated (test) schema reject those rows. */
    @Column(name = "report_id")
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

    /** Which {@link PekProgramIndicator} this specific ProtocolResult satisfies - set only on the
     *  per-result rows PekReportCollectionService creates when a result unambiguously matches one
     *  program indicator by name+unit (protocolResultId non-null on those rows, unlike the
     *  whole-protocol row). This is the real input to plan/fact (PekPlanFactService), not
     *  controlItemId alone - one control item can own several indicators. */
    @Column(name = "program_indicator_id")
    private Long programIndicatorId;

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

    /** Soft link to the order/CRM request this link was created for (matching Protocol's pattern
     *  from V31). Nullable, no FK constraint - enables full-context tracking when protocol is tied
     *  to an order. Same type (String/32) as Protocol.orderId for consistency. */
    @Column(name = "order_id", length = 32)
    private String orderId;

    /** Soft link to a specific line item within the order named by orderId (matching Protocol's
     *  pattern from V31). Only meaningful with orderId set; null when orderId is null or not
     *  specifying a line item. Same type (String/64) as Protocol.orderServiceItemId. */
    @Column(name = "order_service_item_id", length = 64)
    private String orderServiceItemId;

    /** Client-supplied idempotency key (module spec: "clientLinkId используется для
     *  идемпотентности") - a retried create request with the same (protocolId, clientLinkId) pair
     *  returns the existing row instead of inserting a duplicate. Backed by the DB-level unique
     *  index uk_pek_rps_protocol_client_link (V74); this is the only reliable dedup path when
     *  reportId is null (no report yet), since the existing reportId-based checks require a
     *  non-null report. */
    @Column(name = "client_link_id", length = 100)
    private String clientLinkId;

    /**
     * Race-safe identity of the PEK <em>requirement</em> this link fulfils:
     * {@code program:<id>|monitoring:<id>|item:<id>|point:<id>|period:<yyyy-Qn>}. Backed by the
     * DB unique index {@code uk_pek_rps_requirement} (V110), which is the ONLY reliable protection
     * against two concurrent "create protocol from ПЭК" requests both producing a draft for the
     * same requirement - a find-then-save check alone cannot close that window.
     * Null on every row that was not created through the from-ПЭК flow (auto collection, manual
     * linking); both MySQL and H2 treat NULLs in a unique index as distinct, so those rows are
     * unaffected.
     */
    @Column(name = "requirement_key", length = 190, unique = true)
    private String requirementKey;

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

    @Column(name = "match_reason", length = 1000)
    private String matchReason;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

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
    public Long getProgramIndicatorId() { return programIndicatorId; }
    public void setProgramIndicatorId(Long programIndicatorId) { this.programIndicatorId = programIndicatorId; }
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
    public String getMatchReason() { return matchReason; }
    public void setMatchReason(String matchReason) { this.matchReason = matchReason; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getOrderServiceItemId() { return orderServiceItemId; }
    public void setOrderServiceItemId(String orderServiceItemId) { this.orderServiceItemId = orderServiceItemId; }
    public String getRequirementKey() { return requirementKey; }
    public void setRequirementKey(String requirementKey) { this.requirementKey = requirementKey; }
    public String getClientLinkId() { return clientLinkId; }
    public void setClientLinkId(String clientLinkId) { this.clientLinkId = clientLinkId; }
}

