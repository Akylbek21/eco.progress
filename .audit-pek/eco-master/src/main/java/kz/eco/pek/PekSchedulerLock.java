package kz.eco.pek;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** Single mutable row (id=1, seeded by V80) used as a real DB-row lock (SELECT ... FOR UPDATE via
 *  {@link PekSchedulerLockRepository#findForUpdate}) so concurrent/cross-instance scheduler runs
 *  serialize instead of racing - no distributed-lock library (e.g. shedlock) was added since none
 *  existed in pom.xml already and this table achieves the same guarantee for a single-row job. */
@Entity
@Table(name = "pek_scheduler_lock")
public class PekSchedulerLock {

    @Id
    private Long id;

    @Column(nullable = false)
    private boolean locked;

    @Column(name = "locked_at")
    private LocalDateTime lockedAt;

    @Column(name = "locked_by", length = 100)
    private String lockedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }
    public LocalDateTime getLockedAt() { return lockedAt; }
    public void setLockedAt(LocalDateTime lockedAt) { this.lockedAt = lockedAt; }
    public String getLockedBy() { return lockedBy; }
    public void setLockedBy(String lockedBy) { this.lockedBy = lockedBy; }
}
