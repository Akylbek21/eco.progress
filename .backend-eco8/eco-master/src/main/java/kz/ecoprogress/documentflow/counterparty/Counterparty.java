package kz.ecoprogress.documentflow.counterparty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.LocalDateTime;

@Entity
@Table(name = "document_flow_counterparties",
        uniqueConstraints = @UniqueConstraint(name = "uk_dfcp_owner_bin",
                columnNames = {"owner_organization_id", "normalized_bin"}),
        indexes = {
                @Index(name = "idx_dfcp_owner", columnList = "owner_organization_id"),
                @Index(name = "idx_dfcp_status", columnList = "status")
        })
public class Counterparty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_organization_id", nullable = false)
    private Long ownerOrganizationId;

    /** Nullable: a counterparty may or may not itself be a tenant organization in this CRM. */
    @Column(name = "linked_organization_id")
    private Long linkedOrganizationId;

    @Column(name = "bin", nullable = false, length = 32)
    private String bin;

    /** {@link #bin} with whitespace/dashes stripped - the actual uniqueness key, since the same
     *  BIN can otherwise be entered with different formatting. */
    @Column(name = "normalized_bin", nullable = false, length = 32)
    private String normalizedBin;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "director_name", length = 255)
    private String directorName;

    @Column(name = "address", length = 500)
    private String address;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "phone", length = 64)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CounterpartyStatus status = CounterpartyStatus.ACTIVE;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    public static String normalizeBin(String rawBin) {
        return rawBin == null ? null : rawBin.replaceAll("[\\s-]", "");
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOwnerOrganizationId() { return ownerOrganizationId; }
    public void setOwnerOrganizationId(Long ownerOrganizationId) { this.ownerOrganizationId = ownerOrganizationId; }
    public Long getLinkedOrganizationId() { return linkedOrganizationId; }
    public void setLinkedOrganizationId(Long linkedOrganizationId) { this.linkedOrganizationId = linkedOrganizationId; }
    public String getBin() { return bin; }
    public void setBin(String bin) {
        this.bin = bin;
        this.normalizedBin = normalizeBin(bin);
    }
    public String getNormalizedBin() { return normalizedBin; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDirectorName() { return directorName; }
    public void setDirectorName(String directorName) { this.directorName = directorName; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public CounterpartyStatus getStatus() { return status; }
    public void setStatus(CounterpartyStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
