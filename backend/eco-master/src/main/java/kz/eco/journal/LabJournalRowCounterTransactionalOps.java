package kz.eco.journal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Split out from {@link LabJournalRowCounterService} so its REQUIRES_NEW methods are invoked
 * through the Spring AOP proxy (a self-invoked {@code @Transactional} method on the same bean is
 * silently NOT proxied, and the propagation setting would be ignored).
 *
 * <p>Creating the counter row and issuing a number are two separate transactions on purpose. A row
 * number is only ever issued by {@link #tryNextRowNumber} under a {@code SELECT ... FOR UPDATE}
 * lock - including the very first one - so there is no second, unlocked code path that can hand
 * out a number. The previous version returned 1 straight from the create branch, and that branch
 * went through {@code save()}/{@code merge()}, which could overwrite a counter a concurrent
 * transaction had already advanced (see {@link LabJournalRowCounterRepository#insertAtZero}).
 */
@Service
public class LabJournalRowCounterTransactionalOps {

    private final LabJournalRowCounterRepository counterRepository;

    public LabJournalRowCounterTransactionalOps(LabJournalRowCounterRepository counterRepository) {
        this.counterRepository = counterRepository;
    }

    /**
     * Ensures the counter row exists, committing it before returning. Throws
     * {@link org.springframework.dao.DataIntegrityViolationException} when a concurrent
     * transaction created it first - which is harmless: the row exists either way, and only this
     * nested transaction rolls back.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createIfAbsent(Long laboratoryId, String journalType) {
        if (!counterRepository.existsById(new LabJournalRowCounterId(laboratoryId, journalType))) {
            counterRepository.insertAtZero(laboratoryId, journalType);
        }
    }

    /**
     * Locks the counter row, increments it and returns the new value. Empty when the row is not
     * visible yet (a concurrent creator has not committed) - the caller retries.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<Integer> tryNextRowNumber(Long laboratoryId, String journalType) {
        return counterRepository.findForUpdate(laboratoryId, journalType)
                .map(counter -> {
                    counter.setLastRowNumber(counter.getLastRowNumber() + 1);
                    // Managed entity loaded in this transaction - the increment is flushed as an
                    // UPDATE of the row we hold the write lock on, not a merge.
                    return counter.getLastRowNumber();
                });
    }
}
