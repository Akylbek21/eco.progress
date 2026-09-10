package kz.eco.protocol;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pure-JUnit/Mockito coverage (no Spring context, so it actually runs in environments where
 * {@code @SpringBootTest} can't start) for the counter logic that replaced the old
 * MAX(protocol_number)-in-the-same-transaction generator - the root cause of the quick-create 409
 * under concurrent/double-click calls. These tests can't exercise the real pessimistic-lock
 * behavior (that needs a real database), but they do verify the seeding-from-legacy-data and
 * concurrent-insert-recovery logic that a real integration/Testcontainers test would build on top of.
 */
@ExtendWith(MockitoExtension.class)
class ProtocolNumberCounterServiceTest {

    @Mock
    private ProtocolNumberCounterRepository counterRepository;

    @Mock
    private ProtocolRepository protocolRepository;

    @Test
    void nextValue_freshPrefixAndYear_startsAtOne() {
        when(counterRepository.findForUpdate("VDW", 2026)).thenReturn(Optional.empty());
        when(protocolRepository.findByProtocolNumberStartingWith("VDW-2026-")).thenReturn(List.of());
        when(counterRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        ProtocolNumberCounterService service = new ProtocolNumberCounterService(counterRepository, protocolRepository);
        long next = service.nextValue("VDW", 2026);

        assertEquals(1L, next);
    }

    @Test
    void nextValue_existingCounterRow_incrementsLastValue() {
        ProtocolNumberCounter existing = new ProtocolNumberCounter();
        existing.setId(1L);
        existing.setNumberPrefix("VDW");
        existing.setProtocolYear(2026);
        existing.setLastValue(15L);
        when(counterRepository.findForUpdate("VDW", 2026)).thenReturn(Optional.of(existing));

        ProtocolNumberCounterService service = new ProtocolNumberCounterService(counterRepository, protocolRepository);
        long next = service.nextValue("VDW", 2026);

        assertEquals(16L, next);
        ArgumentCaptor<ProtocolNumberCounter> saved = ArgumentCaptor.forClass(ProtocolNumberCounter.class);
        verify(counterRepository).save(saved.capture());
        assertEquals(16L, saved.getValue().getLastValue());
        verify(counterRepository, never()).saveAndFlush(any());
    }

    @Test
    void nextValue_firstTimeWithLegacyProtocols_seedsFromTrueNumericMax() {
        when(counterRepository.findForUpdate("VDW", 2026)).thenReturn(Optional.empty());
        Protocol legacy1 = protocolWithNumber("VDW-2026-0003");
        Protocol legacy2 = protocolWithNumber("VDW-2026-0012");
        Protocol legacy3 = protocolWithNumber("VDW-2026-0007");
        when(protocolRepository.findByProtocolNumberStartingWith("VDW-2026-"))
                .thenReturn(List.of(legacy1, legacy2, legacy3));
        when(counterRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        ProtocolNumberCounterService service = new ProtocolNumberCounterService(counterRepository, protocolRepository);
        long next = service.nextValue("VDW", 2026);

        // Must seed from the true numeric max (12), not lexicographic max ("0012" < "0122" as a
        // string would be wrong once past 4 digits) and not just count()+1 (3 rows would wrongly
        // give 4) - the very bug class this rewrite exists to avoid reintroducing.
        assertEquals(13L, next);
    }

    @Test
    void nextValue_concurrentCounterInsertRace_reFetchesWinnerInsteadOfFailing() {
        when(counterRepository.findForUpdate("VDW", 2026))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(counterWith(5L)));
        when(protocolRepository.findByProtocolNumberStartingWith(any())).thenReturn(List.of());
        when(counterRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

        ProtocolNumberCounterService service = new ProtocolNumberCounterService(counterRepository, protocolRepository);
        long next = service.nextValue("VDW", 2026);

        // Lost the race to insert the counter row, but recovered by re-fetching the winner's row
        // under the write lock and continuing from its value - no exception propagates.
        assertEquals(6L, next);
        verify(counterRepository, times(2)).findForUpdate("VDW", 2026);
    }

    private static Protocol protocolWithNumber(String number) {
        Protocol p = mock(Protocol.class);
        when(p.getProtocolNumber()).thenReturn(number);
        return p;
    }

    private static ProtocolNumberCounter counterWith(long lastValue) {
        ProtocolNumberCounter counter = new ProtocolNumberCounter();
        counter.setId(1L);
        counter.setNumberPrefix("VDW");
        counter.setProtocolYear(2026);
        counter.setLastValue(lastValue);
        return counter;
    }
}
