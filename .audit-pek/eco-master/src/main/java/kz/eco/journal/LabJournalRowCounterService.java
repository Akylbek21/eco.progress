package kz.eco.journal;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * Allocates the next row number for a (laboratoryId, journalType) pair via a dedicated counter
 * table, safe under concurrent POSTs. Each attempt runs in its own REQUIRES_NEW transaction (see
 * {@link LabJournalRowCounterTransactionalOps}) so a lost create-the-counter-row race only rolls
 * back that nested attempt - never the caller's own transaction - and this retries in a fresh
 * transaction/session instead of trying to recover the failed one in place.
 */
@Service
public class LabJournalRowCounterService {

    private static final int MAX_ATTEMPTS = 5;

    private final LabJournalRowCounterTransactionalOps ops;

    public LabJournalRowCounterService(LabJournalRowCounterTransactionalOps ops) {
        this.ops = ops;
    }

    public int allocate(Long laboratoryId, String journalType) {
        DataIntegrityViolationException lastFailure = null;
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                return ops.nextRowNumber(laboratoryId, journalType);
            } catch (DataIntegrityViolationException e) {
                // Another transaction won the race to insert the first counter row for this
                // (laboratoryId, journalType) pair - retry, this time findForUpdate will see it
                // (either immediately, or after blocking on its lock until that transaction ends).
                lastFailure = e;
            }
        }
        throw lastFailure;
    }
}
