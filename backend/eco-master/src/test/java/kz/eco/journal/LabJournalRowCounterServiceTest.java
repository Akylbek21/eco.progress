package kz.eco.journal;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The one part of the Lab Journals audit that a single-threaded MockMvc call can't verify: that
 * concurrent POSTs for the same (laboratoryId, journalType) never hand out the same rowNumber
 * twice. Exercises LabJournalRowCounterService directly (not through the HTTP layer) so the test
 * is about the locking behavior itself, not request plumbing.
 */
@SpringBootTest
class LabJournalRowCounterServiceTest {

    /** Unique negative lab id per run - never collides with real data or with another repetition.
     *  The old {@code nanoTime % 1_000_000} could repeat across repetitions, and a reused id would
     *  continue an earlier counter and fail the "exactly 1..N" check for the wrong reason. */
    private static final AtomicLong NEXT_LAB_ID = new AtomicLong(-System.nanoTime());

    @Autowired
    private LabJournalRowCounterService rowCounterService;

    @Autowired
    private LabJournalRowCounterRepository counterRepository;

    /**
     * Repeated because a race is probabilistic: a single green run proves little. Every repetition
     * starts on a counter row that does not exist yet, which is the exact path that used to issue
     * duplicates - the create-the-first-row race.
     */
    @RepeatedTest(10)
    void allocate_underConcurrentLoad_neverDuplicatesOrSkipsANumber() throws Exception {
        Long laboratoryId = NEXT_LAB_ID.decrementAndGet();
        String journalType = JournalType.SOLUTION_PREPARATION.name();
        int threads = 20;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            // Release every thread at once so they really do contend for the missing counter row,
            // instead of trickling in as the pool spins up.
            CountDownLatch start = new CountDownLatch(1);
            Callable<Integer> task = () -> {
                start.await();
                return rowCounterService.allocate(laboratoryId, journalType);
            };
            List<Future<Integer>> futures = IntStream.range(0, threads)
                    .mapToObj(i -> pool.submit(task))
                    .collect(Collectors.toList());
            start.countDown();

            List<Integer> issued = new java.util.ArrayList<>();
            for (Future<Integer> future : futures) {
                issued.add(future.get(30, TimeUnit.SECONDS));
            }

            Set<Integer> numbers = new java.util.HashSet<>(issued);
            assertEquals(threads, numbers.size(), "every allocated row number must be unique: " + issued);
            Set<Integer> expected = IntStream.rangeClosed(1, threads).boxed().collect(Collectors.toSet());
            assertEquals(expected, numbers, "row numbers must be exactly 1.." + threads + " with no gaps");
            assertEquals(threads, counterRepository.findById(
                            new LabJournalRowCounterId(laboratoryId, journalType)).orElseThrow().getLastRowNumber(),
                    "the stored counter must end at the last number issued");
        } finally {
            pool.shutdownNow();
        }
    }

    /**
     * Production compatibility: counters that already exist keep counting from their stored value.
     * The fix changes how a missing row is created, never how an existing one advances.
     */
    @Test
    void allocate_onExistingCounter_continuesFromStoredValue() {
        Long laboratoryId = NEXT_LAB_ID.decrementAndGet();
        String journalType = JournalType.SOLUTION_PREPARATION.name();
        counterRepository.saveAndFlush(new LabJournalRowCounter(laboratoryId, journalType, 41));

        assertEquals(42, rowCounterService.allocate(laboratoryId, journalType));
        assertEquals(43, rowCounterService.allocate(laboratoryId, journalType));
    }

    /** Counters are per (laboratory, journal type): one journal never consumes another's numbers. */
    @Test
    void allocate_isIndependentPerJournalType() {
        Long laboratoryId = NEXT_LAB_ID.decrementAndGet();

        assertEquals(1, rowCounterService.allocate(laboratoryId, JournalType.SOLUTION_PREPARATION.name()));
        assertEquals(2, rowCounterService.allocate(laboratoryId, JournalType.SOLUTION_PREPARATION.name()));
        assertEquals(1, rowCounterService.allocate(laboratoryId, "OTHER_JOURNAL_TYPE"));
    }
}
