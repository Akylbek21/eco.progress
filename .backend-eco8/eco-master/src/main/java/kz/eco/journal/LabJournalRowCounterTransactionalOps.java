package kz.eco.journal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Split out from {@link LabJournalRowCounterService} so its REQUIRES_NEW method is invoked
 * through the Spring AOP proxy (a self-invoked {@code @Transactional} method on the same bean is
 * silently NOT proxied, and the propagation setting would be ignored).
 */
@Service
public class LabJournalRowCounterTransactionalOps {

    private final LabJournalRowCounterRepository counterRepository;

    public LabJournalRowCounterTransactionalOps(LabJournalRowCounterRepository counterRepository) {
        this.counterRepository = counterRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int nextRowNumber(Long laboratoryId, String journalType) {
        return counterRepository.findForUpdate(laboratoryId, journalType)
                .map(counter -> {
                    counter.setLastRowNumber(counter.getLastRowNumber() + 1);
                    counterRepository.save(counter);
                    return counter.getLastRowNumber();
                })
                .orElseGet(() -> {
                    LabJournalRowCounter counter = new LabJournalRowCounter(laboratoryId, journalType, 1);
                    counterRepository.saveAndFlush(counter);
                    return 1;
                });
    }
}
