package kz.eco.protocol;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * One row per (numberPrefix, protocolYear) - {@code lastValue} is the last sequence number
 * actually handed out. Reading and incrementing it must always go through
 * {@link ProtocolNumberCounterService#nextValue}, which takes a pessimistic write lock on the row
 * for the duration of a short, dedicated transaction - never read/incremented ad hoc, or the same
 * race this table exists to close (two callers computing the same "next" number) comes right back.
 */
@Entity
@Table(name = "protocol_number_counters",
        uniqueConstraints = @UniqueConstraint(name = "uk_protocol_number_counter",
                columnNames = {"number_prefix", "protocol_year"}))
public class ProtocolNumberCounter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "number_prefix", nullable = false, length = 30)
    private String numberPrefix;

    @Column(name = "protocol_year", nullable = false)
    private Integer protocolYear;

    // Backtick-quoted: LAST_VALUE is a reserved MySQL 8+ window-function name, so Hibernate's
    // generated SQL must always quote this identifier or every query touching this entity fails
    // with a SQL syntax error (this is exactly what took production down - see V33 migration fix).
    @Column(name = "`last_value`", nullable = false)
    private Long lastValue = 0L;

    /** Plain bookkeeping counter, not a JPA {@code @Version} - concurrency here is handled by the
     *  explicit pessimistic write lock in ProtocolNumberCounterRepository.findForUpdate, not
     *  optimistic locking. */
    @Column(nullable = false)
    private Long version = 0L;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNumberPrefix() { return numberPrefix; }
    public void setNumberPrefix(String numberPrefix) { this.numberPrefix = numberPrefix; }
    public Integer getProtocolYear() { return protocolYear; }
    public void setProtocolYear(Integer protocolYear) { this.protocolYear = protocolYear; }
    public Long getLastValue() { return lastValue; }
    public void setLastValue(Long lastValue) { this.lastValue = lastValue; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
