package kz.eco.journal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
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

    @Autowired
    private LabJournalRowCounterService rowCounterService;

    @Test
    void allocate_underConcurrentLoad_neverDuplicatesOrSkipsANumber() throws Exception {
        Long laboratoryId = -1L - System.nanoTime() % 1_000_000; // isolated, never collides with real data
        String journalType = JournalType.SOLUTION_PREPARATION.name();
        int threads = 20;

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            AtomicInteger startedTogether = new AtomicInteger(0);
            Callable<Integer> task = () -> {
                startedTogether.incrementAndGet();
                return rowCounterService.allocate(laboratoryId, journalType);
            };
            java.util.List<Future<Integer>> futures = IntStream.range(0, threads)
                    .mapToObj(i -> pool.submit(task))
                    .collect(Collectors.toList());

            Set<Integer> numbers = new java.util.HashSet<>();
            for (Future<Integer> future : futures) {
                numbers.add(future.get(30, TimeUnit.SECONDS));
            }

            assertEquals(threads, numbers.size(), "every allocated row number must be unique: " + numbers);
            Set<Integer> expected = IntStream.rangeClosed(1, threads).boxed().collect(Collectors.toSet());
            assertEquals(expected, numbers, "row numbers must be exactly 1.." + threads + " with no gaps");
        } finally {
            pool.shutdownNow();
        }
    }
}
