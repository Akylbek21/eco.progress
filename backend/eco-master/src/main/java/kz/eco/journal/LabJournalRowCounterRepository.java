package kz.eco.journal;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface LabJournalRowCounterRepository extends JpaRepository<LabJournalRowCounter, LabJournalRowCounterId> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM LabJournalRowCounter c WHERE c.laboratoryId = :laboratoryId AND c.journalType = :journalType")
    Optional<LabJournalRowCounter> findForUpdate(@Param("laboratoryId") Long laboratoryId,
                                                  @Param("journalType") String journalType);

    /**
     * Creates the counter row at 0 with a plain INSERT - never through {@code save()}.
     *
     * <p>The entity has an assigned composite id ({@code @IdClass}), so Spring Data's {@code save()}
     * treats it as not-new and calls {@code merge()}: SELECT, then UPDATE if a concurrent
     * transaction has already committed the row. That UPDATE runs without any lock and silently
     * resets {@code last_row_number}, re-issuing row numbers that were already handed out. A real
     * INSERT instead fails on the primary key when the row exists, which is exactly the signal the
     * caller needs, and can never overwrite a counter another transaction has advanced.
     */
    @Modifying
    @Query(value = "INSERT INTO lab_journal_row_counters (laboratory_id, journal_type, last_row_number) "
            + "VALUES (:laboratoryId, :journalType, 0)", nativeQuery = true)
    int insertAtZero(@Param("laboratoryId") Long laboratoryId, @Param("journalType") String journalType);
}
