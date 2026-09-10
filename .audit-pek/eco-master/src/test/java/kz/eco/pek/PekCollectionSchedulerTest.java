package kz.eco.pek;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.notification.Notification;
import kz.eco.notification.NotificationRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Iteration 4: {@link PekCollectionScheduler} - manual re-run drives the same collection/
 * notification pass as the scheduled job, writes a {@link PekSchedulerRunLog}, is guarded against
 * concurrent runs via {@link PekSchedulerLockRepository}, honors per-company {@link PekSettings}
 * gating, and deduplicates notifications for a still-unresolved condition across repeated runs.
 */
@SpringBootTest
@Transactional
class PekCollectionSchedulerTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;
    @Autowired private PekSettingsRepository settingsRepository;
    @Autowired private PekSchedulerRunLogRepository runLogRepository;
    @Autowired private PekSchedulerLockRepository lockRepository;
    @Autowired private PekNotificationDedupRepository dedupRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private PekCollectionScheduler scheduler;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private User admin;
    private User ecologist;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("Scheduler Company " + System.nanoTime());
        company.setBin(String.valueOf(300000000000L + Math.abs(System.nanoTime() % 600000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Scheduler Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        admin = user("sched-admin-", UserRole.ADMIN);
        ecologist = user("sched-ecologist-", UserRole.ECOLOGIST);
        membership(admin);
        membership(ecologist);
    }

    @Test
    void manualRunCollectsNotifiesAndLogs() {
        settings(companyId, true, true, true, true, 7);
        Long reportId = report(companyId, objectId, ecologist.getId(), PekReportStatus.DRAFT,
                LocalDate.now().plusDays(3));

        PekSchedulerRunLog runLog = scheduler.manualRunAll(admin.getId());

        assertNotNull(runLog);
        assertEquals(PekSchedulerRunStatus.SUCCESS, runLog.getStatus());
        assertEquals(1, runLog.getProcessedCount());
        assertNotNull(runLogRepository.findById(runLog.getId()).orElse(null));

        // No protocols exist -> collect() links 0 -> missing-protocols notification for the
        // report's responsible user (ecologist), plus an approaching-due-date notification since
        // periodEnd is within notifyBeforeDeadlineDays.
        List<Notification> notes = notificationRepository.findByUserIdOrderByCreatedAtDesc(ecologist.getId());
        assertTrue(notes.stream().anyMatch(n -> "missing_protocols".equals(n.getType())));
        assertTrue(notes.stream().anyMatch(n -> "due_date_soon".equals(n.getType())));
    }

    @Test
    void secondRunDoesNotDuplicateNotifications() {
        settings(companyId, true, true, true, true, 7);
        report(companyId, objectId, ecologist.getId(), PekReportStatus.DRAFT, LocalDate.now().plusDays(3));

        scheduler.manualRunAll(admin.getId());
        long afterFirst = notificationRepository.findByUserIdOrderByCreatedAtDesc(ecologist.getId()).size();
        assertTrue(afterFirst > 0);

        scheduler.manualRunAll(admin.getId());
        long afterSecond = notificationRepository.findByUserIdOrderByCreatedAtDesc(ecologist.getId()).size();

        assertEquals(afterFirst, afterSecond, "re-running for the same unresolved condition must not resend notifications");
    }

    @Test
    void disabledSettingsSkipTheOrganization() {
        settings(companyId, false, false, false, false, 7);
        report(companyId, objectId, ecologist.getId(), PekReportStatus.DRAFT, LocalDate.now().plusDays(3));

        PekSchedulerRunLog runLog = scheduler.manualRunAll(admin.getId());

        assertNotNull(runLog);
        assertEquals(0, runLog.getProcessedCount());
        assertTrue(notificationRepository.findByUserIdOrderByCreatedAtDesc(ecologist.getId()).isEmpty());
    }

    @Test
    void concurrentRunIsSkippedNotDuplicated() {
        settings(companyId, true, true, true, true, 7);
        report(companyId, objectId, ecologist.getId(), PekReportStatus.DRAFT, LocalDate.now().plusDays(3));

        // First real run creates+releases the lock row (test schema has no Flyway seed row), then
        // this test re-acquires it itself to simulate a concurrent run in progress.
        assertNotNull(scheduler.manualRunAll(admin.getId()));
        LocalDateTime now = LocalDateTime.now();
        int acquired = lockRepository.tryAcquire(1L, now, "OTHER_RUN", now.minusMinutes(30));
        assertEquals(1, acquired, "test setup should have acquired the lock itself");

        PekSchedulerRunLog runLog = scheduler.manualRunAll(admin.getId());

        assertNull(runLog, "a run triggered while another holds the lock must be skipped, not executed twice");
        lockRepository.release(1L);
    }

    @Test
    void manualRerunEndpointWorksAndIsAdminGated() throws Exception {
        settings(companyId, true, true, true, true, 7);
        report(companyId, objectId, ecologist.getId(), PekReportStatus.DRAFT, LocalDate.now().plusDays(3));

        mvc.perform(post("/api/pek/scheduler/run").param("companyId", String.valueOf(companyId)).with(as(admin)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/pek/scheduler/run").param("companyId", String.valueOf(companyId)).with(as(ecologist)))
                .andExpect(status().isForbidden());
    }

    @Test
    void overdueCorrectiveActionAndOpenExceedanceAreNotified() {
        settings(companyId, false, false, true, true, 7);
        Long reportId = report(companyId, objectId, ecologist.getId(), PekReportStatus.READY_FOR_REVIEW,
                LocalDate.now().plusMonths(1));

        PekReportExceedance exceedance = new PekReportExceedance();
        exceedance.setReportId(reportId);
        exceedance.setPlanFactRowId(1L);
        exceedance.setProtocolId(1L);
        exceedance.setProtocolResultId(System.nanoTime());
        exceedance.setProgramIndicatorId(1L);
        exceedance.setActualValue(java.math.BigDecimal.valueOf(10));
        exceedance.setNormativeValue(java.math.BigDecimal.valueOf(5));
        exceedance.setComparisonType(kz.eco.protocol.ComparisonType.LESS_OR_EQUAL);
        exceedance.setExceedanceRatio(java.math.BigDecimal.valueOf(2));
        exceedance.setSeverity(PekExceedanceSeverity.MEDIUM);
        exceedance.setStatus(PekExceedanceStatus.OPEN);
        exceedance.setResponsibleUserId(ecologist.getId());
        exceedance.setDueDate(LocalDate.now().minusDays(2));
        exceedanceRepository.saveAndFlush(exceedance);

        PekSchedulerRunLog runLog = scheduler.manualRunAll(admin.getId());
        assertNotNull(runLog);

        List<Notification> notes = notificationRepository.findByUserIdOrderByCreatedAtDesc(ecologist.getId());
        assertTrue(notes.stream().anyMatch(n -> "open_exceedance".equals(n.getType())));
        assertTrue(notes.stream().anyMatch(n -> "overdue_action".equals(n.getType())));
    }

    private void settings(Long companyId, boolean autoCollect, boolean notifyMissing, boolean notifyExceed,
                          boolean notifyReturned, int leadDays) {
        PekSettings s = new PekSettings();
        s.setCompanyId(companyId);
        s.setDefaultReportType(PekSettingsReportType.QUARTERLY);
        s.setAutoCollectProtocols(autoCollect);
        s.setIncludeOnlySignedProtocols(true);
        s.setAllowFallbackMatching(true);
        s.setRequireManualAmbiguousConfirmation(true);
        s.setRequireAllPlanFactItems(true);
        s.setBlockSubmitWithUnmatchedResults(true);
        s.setBlockSubmitWithAmbiguousResults(true);
        s.setBlockSubmitWithStaleSources(true);
        s.setBlockSubmitWithOpenExceedances(true);
        s.setNotifyBeforeDeadlineDays(leadDays);
        s.setNotifyMissingProtocols(notifyMissing);
        s.setNotifyExceedances(notifyExceed);
        s.setNotifyReportReturned(notifyReturned);
        s.setCreatedBy(admin.getId());
        s.setUpdatedBy(admin.getId());
        settingsRepository.saveAndFlush(s);
    }

    private Long activeProgram() {
        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("SCHED-" + System.nanoTime());
        program.setName("Scheduler test program");
        program.setValidFrom(LocalDate.of(2020, 1, 1));
        program.setValidUntil(LocalDate.of(2030, 12, 31));
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setCreatedBy(admin.getId());
        programRepository.save(program);
        return program.getId();
    }

    private Long report(Long companyId, Long objectId, Long responsibleUserId, PekReportStatus status, LocalDate periodEnd) {
        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(activeProgram());
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(periodEnd.getYear());
        report.setReportQuarter(1);
        report.setPeriodStart(periodEnd.minusMonths(3));
        report.setPeriodEnd(periodEnd);
        // The scheduler's approaching-due-date check now reads submissionDueDate (the real
        // regulatory deadline), not periodEnd - set it explicitly so tests built around "periodEnd
        // is soon" still exercise that check the way they did before the fix.
        report.setSubmissionDueDate(periodEnd);
        report.setStatus(status);
        report.setResponsibleUserId(responsibleUserId);
        report.setCreatedBy(responsibleUserId);
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        return report.getId();
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName(role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private void membership(User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }
}
