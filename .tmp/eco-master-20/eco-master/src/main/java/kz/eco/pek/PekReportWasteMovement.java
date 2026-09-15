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
 * Movement of one {@link PekWasteItem} over one reporting period: остаток на начало, образование,
 * передача, удаление, остаток на конец, плюс получатель и его БИН.
 *
 * <p>These are facts about a period, so they hang off the report rather than the program - see
 * {@link PekWasteItem} for why the catalogue and the movements are separate tables. One row per
 * (report, waste item), enforced by a unique constraint so a waste type cannot be reported twice
 * in the same period with different figures.
 */
@Entity
@Table(name = "pek_report_waste_movements",
        uniqueConstraints = @UniqueConstraint(name = "uk_pek_waste_movement_report_item",
                columnNames = {"report_id", "waste_item_id"}))
public class PekReportWasteMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id", nullable = false)
    private Long reportId;

    @Column(name = "waste_item_id", nullable = false)
    private Long wasteItemId;

    @Column(name = "opening_balance", precision = 18, scale = 4)
    private BigDecimal openingBalance;

    /** Amount generated during the period (образование). Column is {@code generated_amount}:
     *  GENERATED is a reserved word in MySQL 8. */
    @Column(name = "generated_amount", precision = 18, scale = 4)
    private BigDecimal generated;

    /** Amount handed over to a third party (передача). */
    @Column(precision = 18, scale = 4)
    private BigDecimal transferred;

    /** Amount disposed of / neutralised (удаление, обезвреживание). */
    @Column(precision = 18, scale = 4)
    private BigDecimal disposed;

    @Column(name = "closing_balance", precision = 18, scale = 4)
    private BigDecimal closingBalance;

    @Column(name = "receiver_name", length = 500)
    private String receiverName;

    @Column(name = "receiver_bin", length = 12)
    private String receiverBin;

    @Column(length = 2000)
    private String note;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Version
    @Column(nullable = false)
    private Long version;

    /**
     * Closing balance implied by the other figures. Used to flag a row whose stated
     * {@link #closingBalance} does not reconcile, rather than to silently overwrite what the user
     * entered - the entered figure is what gets reported, and a mismatch is worth surfacing, not
     * hiding.
     */
    public BigDecimal impliedClosingBalance() {
        return nz(openingBalance).add(nz(generated)).subtract(nz(transferred)).subtract(nz(disposed));
    }

    public boolean reconciles() {
        return closingBalance == null || closingBalance.compareTo(impliedClosingBalance()) == 0;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public Long getWasteItemId() { return wasteItemId; }
    public void setWasteItemId(Long wasteItemId) { this.wasteItemId = wasteItemId; }
    public BigDecimal getOpeningBalance() { return openingBalance; }
    public void setOpeningBalance(BigDecimal openingBalance) { this.openingBalance = openingBalance; }
    public BigDecimal getGenerated() { return generated; }
    public void setGenerated(BigDecimal generated) { this.generated = generated; }
    public BigDecimal getTransferred() { return transferred; }
    public void setTransferred(BigDecimal transferred) { this.transferred = transferred; }
    public BigDecimal getDisposed() { return disposed; }
    public void setDisposed(BigDecimal disposed) { this.disposed = disposed; }
    public BigDecimal getClosingBalance() { return closingBalance; }
    public void setClosingBalance(BigDecimal closingBalance) { this.closingBalance = closingBalance; }
    public String getReceiverName() { return receiverName; }
    public void setReceiverName(String receiverName) { this.receiverName = receiverName; }
    public String getReceiverBin() { return receiverBin; }
    public void setReceiverBin(String receiverBin) { this.receiverBin = receiverBin; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getVersion() { return version; }
}
