package kz.eco.journal;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Allocates the next row number for a (laboratoryId, journalType) pair via a dedicated counter
 * table, safe under concurrent POSTs. Row numbers are accounting identifiers in a journal shown to
 * inspectors, so the guarantee is strict: every number is issued exactly once, with no gaps.
 *
 * <p>Each step runs in its own REQUIRES_NEW transaction (see
 * {@link LabJournalRowCounterTransactionalOps}) so a lost create-the-counter-row race only rolls
 * back that nested attempt - never the caller's own transaction - and the retry starts from a fresh
 * transaction/session instead of trying to recover the failed one in place.
 */
@Service
public class LabJournalRowCounterService {

    /** Retries only cover the brief window where a concurrent creator's row is not yet visible;
     *  once it exists, the locked path succeeds on the first try. */
    private static final int MAX_ATTEMPTS = 20;
    private static final long BACKOFF_MILLIS = 5;

    private final LabJournalRowCounterTransactionalOps ops;

    public LabJournalRowCounterService(LabJournalRowCounterTransactionalOps ops) {
        this.ops = ops;
    }

    public int allocate(Long laboratoryId, String journalType) {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                ops.createIfAbsent(laboratoryId, journalType);
            } catch (DataIntegrityViolationException alreadyCreated) {
                // A concurrent transaction inserted the counter row first. That is the expected
                // outcome of the race, not an error: the row exists, fall through to the locked path.
            }
            Optional<Integer> issued = ops.tryNextRowNumber(laboratoryId, journalType);
            if (issued.isPresent()) {
                return issued.get();
            }
            // The creator has not committed yet on this database - wait a moment and retry.
            sleepQuietly();
        }
        throw new IllegalStateException("Не удалось выделить номер строки журнала для laboratoryId="
                + laboratoryId + ", journalType=" + journalType + " за " + MAX_ATTEMPTS + " попыток");
    }

    private static void sleepQuietly() {
        try {
            Thread.sleep(BACKOFF_MILLIS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Выделение номера строки журнала прервано", e);
        }
    }
}
