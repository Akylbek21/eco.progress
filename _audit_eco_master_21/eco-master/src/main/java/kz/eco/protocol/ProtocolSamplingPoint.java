package kz.eco.protocol;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * A named location where samples are collected for a protocol. Required for AMBIENT_AIR_SZZ
 * (санитарно-защитная зона) where each measurement must carry a spatial reference. Optional
 * for all other protocol types (samplingPointId on ProtocolResult stays null for legacy data).
 *
 * <p>Model: Protocol 1 → N ProtocolSamplingPoint → N ProtocolResult.
 * Four cardinal compass directions are the common case, but the model is deliberately open to
 * arbitrary names so operators are not forced into a North/South/East/West straitjacket.
 */
@Entity
@Table(name = "protocol_sampling_points",
       indexes = @Index(name = "idx_sampling_points_protocol_id", columnList = "protocol_id, sort_order"))
public class ProtocolSamplingPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "protocol_id", nullable = false)
    private Long protocolId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 600)
    private String description;

    @Column(precision = 10, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 6)
    private BigDecimal longitude;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getProtocolId() { return protocolId; }
    public void setProtocolId(Long protocolId) { this.protocolId = protocolId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
