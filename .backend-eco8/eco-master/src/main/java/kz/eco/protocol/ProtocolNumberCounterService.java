package kz.eco.protocol;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Split into its own bean (not a private method on ProtocolNumberGenerator) so the REQUIRES_NEW
 * transaction below actually goes through the Spring AOP proxy - a self-invoked
 * {@code @Transactional} method on the same bean is silently NOT proxied, and the propagation
 * setting would be ignored. Same pattern as CompanyPrimaryObjectMaterializer /
 * LabJournalRowCounterTransactionalOps.
 * <p>
 * This is the fix for the root cause of the quick-create 409: the old generator read
 * {@code MAX(protocol_number)} and incremented it with zero locking, inside the same transaction
 * as the protocol INSERT - two callers (a double-click, or two genuinely concurrent requests)
 * could both read the same "last" row before either committed, compute the same next number, and
 * collide on {@code lab_protocols.protocol_number}'s UNIQUE constraint, which surfaced as a
 * generic {@code DataIntegrityViolationException} -> 409. Reserving the next sequence value
 * through a row-level pessimistic lock on a dedicated, short-lived counter row closes that race:
 * the lock is held only for the few milliseconds it takes to read+increment+commit this nested
 * transaction, not for the whole (much longer) protocol-creation transaction.
 */
@Service
public class ProtocolNumberCounterService {

    private final ProtocolNumberCounterRepository counterRepository;
    private final ProtocolRepository protocolRepository;

    public ProtocolNumberCounterService(ProtocolNumberCounterRepository counterRepository,
                                        ProtocolRepository protocolRepository) {
        this.counterRepository = counterRepository;
        this.protocolRepository = protocolRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long nextValue(String prefix, int year) {
        ProtocolNumberCounter counter = counterRepository.findForUpdate(prefix, year).orElse(null);
        if (counter == null) {
            counter = createCounterRow(prefix, year);
        }
        long next = counter.getLastValue() + 1;
        counter.setLastValue(next);
        counterRepository.save(counter);
        return next;
    }

    /**
     * First-ever call for this (prefix, year): seeds the counter from any existing
     * {@code lab_protocols} rows with that prefix+year (numeric max, not lexicographic - see
     * ProtocolRepository.findByProtocolNumberStartingWith) instead of starting blindly at 0, so a
     * database that already has protocols from before this counter table existed doesn't
     * immediately collide on its very first reservation. Handles the case where a concurrent
     * transaction inserts the same (prefix, year) row first (unique constraint on
     * number_prefix+protocol_year) by re-fetching under the write lock instead of failing.
     */
    private ProtocolNumberCounter createCounterRow(String prefix, int year) {
        long seed = protocolRepository.findByProtocolNumberStartingWith(prefix + "-" + year + "-").stream()
                .map(Protocol::getProtocolNumber)
                .mapToLong(this::parseSequenceOrZero)
                .max()
                .orElse(0L);
        ProtocolNumberCounter counter = new ProtocolNumberCounter();
        counter.setNumberPrefix(prefix);
        counter.setProtocolYear(year);
        counter.setLastValue(seed);
        try {
            return counterRepository.saveAndFlush(counter);
        } catch (DataIntegrityViolationException ex) {
            // Another concurrent REQUIRES_NEW transaction won the race to insert this exact
            // (prefix, year) row first - its insert has already committed (REQUIRES_NEW = its own
            // transaction), so re-fetching under the write lock here is safe and correct.
            return counterRepository.findForUpdate(prefix, year).orElseThrow(() -> ex);
        }
    }

    private long parseSequenceOrZero(String protocolNumber) {
        int idx = protocolNumber.lastIndexOf('-');
        if (idx < 0 || idx == protocolNumber.length() - 1) {
            return 0L;
        }
        try {
            return Long.parseLong(protocolNumber.substring(idx + 1));
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }
}
