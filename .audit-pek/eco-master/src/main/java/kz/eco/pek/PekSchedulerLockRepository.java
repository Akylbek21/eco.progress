package kz.eco.pek;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

public interface PekSchedulerLockRepository extends JpaRepository<PekSchedulerLock, Long> {

    /** Atomic acquire: a single conditional UPDATE (row-level atomic regardless of surrounding
     *  transaction boundaries) rather than a SELECT ... FOR UPDATE followed by a separate write -
     *  avoids the classic Spring AOP self-invocation trap where a protected {@code @Transactional}
     *  method called via {@code this.xxx()} from within the same bean silently runs without the
     *  intended transaction. Reclaims a lock whose lockedAt is older than staleThreshold (a
     *  crashed/stuck previous run). Returns the number of rows updated: 1 = lock acquired, 0 =
     *  already held by another still-fresh run. */
    @Modifying
    @Transactional
    @Query("update PekSchedulerLock l set l.locked = true, l.lockedAt = :now, l.lockedBy = :by " +
            "where l.id = :id and (l.locked = false or l.lockedAt < :staleThreshold)")
    int tryAcquire(@Param("id") Long id, @Param("now") LocalDateTime now, @Param("by") String by,
                   @Param("staleThreshold") LocalDateTime staleThreshold);

    @Modifying
    @Transactional
    @Query("update PekSchedulerLock l set l.locked = false where l.id = :id")
    void release(@Param("id") Long id);
}
