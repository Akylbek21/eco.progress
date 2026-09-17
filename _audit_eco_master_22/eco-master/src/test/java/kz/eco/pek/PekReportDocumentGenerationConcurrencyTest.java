package kz.eco.pek;

import kz.eco.pek.docgen.PekReportDocumentGenerationService;
import kz.eco.protocol.PekProgramTestFixture;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Race safety of the PEK document-version sequence.
 *
 * <p>The next version is {@code MAX(version) + 1} over one shared OFFICIAL/INTERNAL sequence per
 * report. Computed without a row lock, two concurrent generations read the same MAX and the loser
 * dies on {@code uk_pek_report_document_versions_report_version} - surfacing to the client as a
 * misleading {@code REFERENCE_CONFLICT}. Both generation entry points now take
 * {@code PekReportRepository#findByIdForUpdate} first, so the two requests serialize.
 *
 * <p>Deliberately NOT {@code @Transactional}: a real unique index can only be hit if each thread
 * actually commits, which a test-managed rollback-only transaction would prevent. Both threads are
 * released together by a {@link CountDownLatch}.
 */
@SpringBootTest
class PekReportDocumentGenerationConcurrencyTest {

    @Autowired private PekReportDocumentGenerationService generationService;
    @Autowired private PekReportDocumentVersionRepository versionRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPackageService packageService;
    @Autowired private PekReportPackageRepository packageRepository;
    @Autowired private PekProgramTestFixture fixtures;

    private User head;
    private Long reportId;
    private Long userId;

    @BeforeEach
    void setUp() {
        head = fixtures.user("pek-docgen-race-", UserRole.HEAD);
        userId = head.getId();
        PekProgramTestFixture.Fixture f = fixtures.standard(2026, UserRole.HEAD, head);

        PekReport report = new PekReport();
        report.setCompanyId(f.companyId());
        report.setObjectId(f.objectId());
        report.setProgramId(f.programId());
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.DRAFT);
        report.setResponsibleUserId(head.getId());
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        reportId = report.getId();
    }

    /** Item 7: official and internal documents of the SAME report, generated in parallel. Both must
     *  succeed and land on different, consecutive numbers of the shared sequence. */
    @Test
    void officialAndInternalGeneratedConcurrently_getDistinctConsecutiveVersions() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<PekReportDocumentVersion> official = pool.submit(
                    task(start, () -> generationService.generateOfficialDocx(reportId, userId)));
            Future<PekReportDocumentVersion> internal = pool.submit(
                    task(start, () -> generationService.generateInternalDocx(reportId, userId)));
            start.countDown();
            PekReportDocumentVersion o = official.get(120, TimeUnit.SECONDS);
            PekReportDocumentVersion i = internal.get(120, TimeUnit.SECONDS);

            assertEquals(PekReportDocumentType.OFFICIAL, o.getDocumentType());
            assertEquals(PekReportDocumentType.INTERNAL, i.getDocumentType());
            assertNotNull(o.getDocxFileId());
            assertNotNull(i.getDocxFileId());
            assertEquals(List.of(1, 2), List.of(Math.min(o.getVersion(), i.getVersion()),
                            Math.max(o.getVersion(), i.getVersion())),
                    "the shared OFFICIAL/INTERNAL sequence must hand out 1 and 2, not the same number twice");
        } finally {
            pool.shutdownNow();
        }

        List<PekReportDocumentVersion> all = versionRepository.findByReportIdOrderByVersionDesc(reportId);
        assertEquals(2, all.size(), "both versions must be persisted; neither overwrites the other");
        assertEquals(2, all.stream().map(PekReportDocumentVersion::getVersion).distinct().count());
    }

    /** Item 8: a plain document generation racing the ZIP package build, which generates the final
     *  PDF (another version row) as a side effect. */
    @Test
    void documentAndPackageGeneratedConcurrently_bothSucceed() throws Exception {
        Long expectedReportVersion = reportRepository.findById(reportId).orElseThrow().getVersion();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<PekReportDocumentVersion> doc = pool.submit(
                    task(start, () -> generationService.generateInternalDocx(reportId, userId)));
            Future<Object> pack = pool.submit(
                    task(start, () -> packageService.generate(reportId, userId, expectedReportVersion)));
            start.countDown();
            PekReportDocumentVersion d = doc.get(180, TimeUnit.SECONDS);
            Object p = pack.get(180, TimeUnit.SECONDS);
            assertNotNull(d.getDocxFileId());
            assertNotNull(p);
        } finally {
            pool.shutdownNow();
        }

        List<PekReportDocumentVersion> all = versionRepository.findByReportIdOrderByVersionDesc(reportId);
        assertEquals(2, all.size(), "the document and the package's final PDF are two separate versions");
        assertEquals(2, all.stream().map(PekReportDocumentVersion::getVersion).distinct().count(),
                "the two version numbers must differ");
        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isPresent());
    }

    /** Runs the body with this test's authenticated user on the worker thread, after both workers
     *  have been released simultaneously. */
    private <T> Callable<T> task(CountDownLatch start, Callable<T> body) {
        return () -> {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(head, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + head.getRole().name()))));
            try {
                start.await(10, TimeUnit.SECONDS);
                return body.call();
            } finally {
                SecurityContextHolder.clearContext();
            }
        };
    }
}
