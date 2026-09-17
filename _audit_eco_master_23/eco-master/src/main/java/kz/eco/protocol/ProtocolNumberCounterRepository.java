package kz.eco.protocol;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProtocolNumberCounterRepository extends JpaRepository<ProtocolNumberCounter, Long> {

    /** Takes a row-level pessimistic write lock (SELECT ... FOR UPDATE) for the caller's
     *  transaction - must only ever be called from inside a short, dedicated
     *  REQUIRES_NEW transaction (see ProtocolNumberCounterService), never from a long-running
     *  caller transaction, or the lock would be held far longer than necessary. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select c
            from ProtocolNumberCounter c
            where c.numberPrefix = :prefix
              and c.protocolYear = :year
            """)
    Optional<ProtocolNumberCounter> findForUpdate(@Param("prefix") String prefix, @Param("year") Integer year);
}
