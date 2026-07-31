package kz.eco.journal;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface LabJournalRowCounterRepository extends JpaRepository<LabJournalRowCounter, LabJournalRowCounterId> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM LabJournalRowCounter c WHERE c.laboratoryId = :laboratoryId AND c.journalType = :journalType")
    Optional<LabJournalRowCounter> findForUpdate(@Param("laboratoryId") Long laboratoryId,
                                                  @Param("journalType") String journalType);
}
