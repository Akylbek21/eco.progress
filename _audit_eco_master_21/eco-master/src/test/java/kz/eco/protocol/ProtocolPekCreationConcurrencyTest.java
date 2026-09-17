package kz.eco.protocol;

import kz.eco.common.exception.ConflictException;
import kz.eco.pek.PekFrequencyType;
import kz.eco.pek.PekProgramStatus;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.protocol.dto.ProtocolPekCreationDtos;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Blocker 1, race safety. Deliberately NOT {@code @Transactional}: two concurrent requests can only
 * collide on a real unique index if each one actually commits, which a test-managed rollback-only
 * transaction would prevent. Two threads are released simultaneously by a {@link CountDownLatch};
 * exactly one protocol must exist afterwards and the loser must get
 * {@code PROTOCOL_DRAFT_ALREADY_EXISTS}.
 */
@SpringBootTest
class ProtocolPekCreationConcurrencyTest {

    @Autowired private ProtocolPekCreationService creationService;
    @Autowired private PekProgramTestFixture fixtures;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;

    private User head;
    private PekProgramTestFixture.Fixture f;
    private LocalDate date;

    @BeforeEach
    void setUp() {
        head = fixtures.user("pek-race-head-", UserRole.HEAD);
        date = LocalDate.now();
        f = fixtures.standard(date.getYear(), head, PekFrequencyType.QUARTERLY, 1,
                PekProgramStatus.ACTIVE, true);

        // Warm-up on a SEPARATE programme so the shared protocol-number counter row for this
        // template+year already exists. Without it the two racing threads would also collide on
        // the very first insert into protocol_number_counters, and that unrelated pre-existing
        // race (ProtocolNumberCounterService#createCounterRow) would mask the requirement race
        // this test is actually about.
        PekProgramTestFixture.Fixture warmUp = fixtures.standard(date.getYear(), head,
                PekFrequencyType.QUARTERLY, 1, PekProgramStatus.ACTIVE, true);
        creationService.createFromPek(new ProtocolPekCreationDtos.CreateProtocolFromPekRequest(
                warmUp.companyId(), warmUp.objectId(), warmUp.programId(), warmUp.monitoringId(),
                warmUp.controlItemId(), warmUp.pointId(), "ambient_air", warmUp.indicatorId(),
                date.toString()), head);
    }

    @Test
    void twoConcurrentRequests_createExactlyOneDraft() throws Exception {
        ProtocolPekCreationDtos.CreateProtocolFromPekRequest request =
                new ProtocolPekCreationDtos.CreateProtocolFromPekRequest(
                        f.companyId(), f.objectId(), f.programId(), f.monitoringId(), f.controlItemId(),
                        f.pointId(), "ambient_air", f.indicatorId(), date.toString());

        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger created = new AtomicInteger();
        AtomicInteger conflicts = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Void> task = () -> {
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(head, null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + head.getRole().name()))));
                start.await(10, TimeUnit.SECONDS);
                try {
                    creationService.createFromPek(request, head);
                    created.incrementAndGet();
                } catch (ConflictException ex) {
                    assertEquals("PROTOCOL_DRAFT_ALREADY_EXISTS", ex.getCode());
                    conflicts.incrementAndGet();
                } finally {
                    SecurityContextHolder.clearContext();
                }
                return null;
            };
            Future<Void> a = pool.submit(task);
            Future<Void> b = pool.submit(task);
            start.countDown();
            a.get(60, TimeUnit.SECONDS);
            b.get(60, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertEquals(1, created.get(), "exactly one request may create the draft");
        assertEquals(1, conflicts.get(), "the loser must see PROTOCOL_DRAFT_ALREADY_EXISTS");

        long linksForRequirement = sourceRepository.findByProgramIdAndControlItemIdAndExcludedFalseOrderByIdAsc(
                        f.programId(), f.controlItemId()).stream()
                .filter(s -> s.getRequirementKey() != null)
                .count();
        assertEquals(1, linksForRequirement, "the DB unique index must allow only one link row");
    }
}
