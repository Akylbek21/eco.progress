package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Module fix (P1 business logic) integration coverage: role-aware program availableActions,
 * SIGNED -> ARCHIVED, document staleness DTO, report filters + pagination, scheduler
 * company-scoping, collect() If-Match, program readiness gate, maker-checker, and
 * membership.roleCode as a real company-scoped permission tier.
 */
@SpringBootTest
@Transactional
class PekP1BusinessLogicTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramReadinessFixture readinessFixture;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportDocumentVersionRepository documentVersionRepository;
    @Autowired private PekCollectionScheduler scheduler;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private User creator;
    private User reviewer;
    private User viewer;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK P1 Test " + System.nanoTime());
        company.setBin(String.valueOf(900000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("P1 Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        // creator: membership.roleCode=ECOLOGIST -> EDIT tier (create/edit/submit, never approve/
        // review). reviewer: membership.roleCode=HEAD -> REVIEW tier. viewer: membership.
        // roleCode=LABORATORY -> below the EDIT tier, view-only for company-scoped actions.
        creator = user("pek-p1-creator-", UserRole.ECOLOGIST);
        reviewer = user("pek-p1-reviewer-", UserRole.HEAD);
        viewer = user("pek-p1-viewer-", UserRole.LABORATORY);
        membership(creator, UserRole.ECOLOGIST);
        membership(reviewer, UserRole.HEAD);
        membership(viewer, UserRole.LABORATORY);
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

    private void membership(User user, UserRole roleCode) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(roleCode));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private Long createReadyProgram() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "P1-%d", "name": "Программа P1",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d,
                 "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId, System.nanoTime(), creator.getId());
        MvcResult result = mvc.perform(post("/api/pek/programs").with(as(creator))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        Long programId = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
        // "Ready" now genuinely means ready: the mandatory program sections are blocking checks.
        readinessFixture.makeReady(programId);
        return programId;
    }

    // ---- item 1: role-aware program availableActions ------------------------------------------

    @Test
    void viewerMembership_doesNotGetEditOrApproveActions() throws Exception {
        Long programId = createReadyProgram();
        mvc.perform(get("/api/pek/programs/" + programId).with(as(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.edit").value(false))
                .andExpect(jsonPath("$.data.availableActions.submit").value(false))
                .andExpect(jsonPath("$.data.availableActions.approve").value(false))
                .andExpect(jsonPath("$.data.availableActions.clone").value(false));
    }

    @Test
    void reviewerMembership_getsApproveOnceUnderReview() throws Exception {
        Long programId = createReadyProgram();
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(creator))
                        .header("If-Match", "0"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/pek/programs/" + programId).with(as(reviewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"))
                .andExpect(jsonPath("$.data.availableActions.approve").value(true))
                .andExpect(jsonPath("$.data.availableActions.returnForRevision").value(true));

        // The endpoint itself must agree with what availableActions advertised.
        mvc.perform(post("/api/pek/programs/" + programId + "/approve").with(as(reviewer))
                        .header("If-Match", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    // ---- item 2: SIGNED -> ARCHIVED -------------------------------------------------------------

    @Test
    void signedReport_canBeArchivedByReviewer() throws Exception {
        PekReport report = signedReport();

        mvc.perform(get("/api/pek/reports/" + report.getId()).with(as(reviewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.archive").value(true));

        mvc.perform(post("/api/pek/reports/" + report.getId() + "/archive").with(as(reviewer))
                        .header("If-Match", String.valueOf(report.getVersion())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));

        PekReport persisted = reportRepository.findById(report.getId()).orElseThrow();
        assertEquals(PekReportStatus.ARCHIVED, persisted.getStatus());
    }

    private PekReport signedReport() {
        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.SIGNED);
        report.setResponsibleUserId(reviewer.getId());
        report.setCreatedBy(creator.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        return report;
    }

    // ---- item 3: document version staleness DTO --------------------------------------------------

    @Test
    void staleDocumentVersion_isFlaggedInResponseDto() throws Exception {
        PekReport report = signedReport();
        report.setContentRevision(5L);
        reportRepository.saveAndFlush(report);

        PekReportDocumentVersion v = new PekReportDocumentVersion();
        v.setReportId(report.getId());
        v.setVersion(1);
        v.setPdfFileId("some-file-id");
        v.setContentHash("test-hash");
        v.setSnapshotJson("{}");
        v.setSourceContentRevision(3L); // stale: report is already at contentRevision=5
        v.setGeneratedAt(LocalDateTime.now());
        v.setGeneratedBy(creator.getId());
        documentVersionRepository.saveAndFlush(v);

        mvc.perform(get("/api/pek/reports/" + report.getId() + "/document/versions/latest").with(as(reviewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourceContentRevision").value(3))
                .andExpect(jsonPath("$.data.currentContentRevision").value(5))
                .andExpect(jsonPath("$.data.stale").value(true));

        // Reflected in availableActions too - never true for an action the download/sign endpoint
        // would then reject as PEK_DOCUMENT_STALE.
        mvc.perform(get("/api/pek/reports/" + report.getId()).with(as(reviewer)))
                .andExpect(jsonPath("$.data.availableActions.downloadPdf").value(false));
    }

    // ---- item 4: report filters + pagination -----------------------------------------------------

    @Test
    void reportFilters_applyBeforePagination() throws Exception {
        PekReport draft = report(PekReportStatus.DRAFT, 1);
        PekReport collecting = report(PekReportStatus.COLLECTING, 2);
        PekReport returned = report(PekReportStatus.RETURNED, 3);
        reportRepository.saveAndFlush(draft);
        reportRepository.saveAndFlush(collecting);
        reportRepository.saveAndFlush(returned);

        MvcResult filtered = mvc.perform(get("/api/pek/reports")
                        .param("companyId", String.valueOf(companyId))
                        .param("status", "DRAFT")
                        .with(as(reviewer)))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(1, ((Number) JsonPath.read(filtered.getResponse().getContentAsString(), "$.data.totalElements")).intValue());

        MvcResult paged = mvc.perform(get("/api/pek/reports")
                        .param("companyId", String.valueOf(companyId))
                        .param("page", "0").param("size", "2")
                        .with(as(reviewer)))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(3, ((Number) JsonPath.read(paged.getResponse().getContentAsString(), "$.data.totalElements")).intValue());
        assertEquals(2, ((Number) JsonPath.read(paged.getResponse().getContentAsString(), "$.data.totalPages")).intValue());
        assertEquals(2, ((List<?>) JsonPath.read(paged.getResponse().getContentAsString(), "$.data.items")).size());
    }

    private PekReport report(PekReportStatus status, int quarter) {
        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(quarter);
        report.setPeriodStart(LocalDate.of(2026, quarter * 3 - 2, 1));
        report.setPeriodEnd(LocalDate.of(2026, quarter * 3, 28));
        report.setStatus(status);
        report.setCreatedBy(creator.getId());
        report.computePeriodKey();
        return report;
    }

    // ---- item 5: scheduler company-scoping ---------------------------------------------------

    @Test
    void manualRun_scopedToOneCompany_neverTouchesOtherCompanies() throws Exception {
        Company otherCompany = new Company();
        otherCompany.setName("PEK P1 Other Company " + System.nanoTime());
        otherCompany.setBin(String.valueOf(910000000000L + Math.abs(System.nanoTime() % 80000000000L)));
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        CompanyObject otherObject = new CompanyObject();
        otherObject.setCompanyId(otherCompany.getId());
        otherObject.setName("Other Company Object");
        otherObject.setStatus("ACTIVE");
        companyObjectRepository.save(otherObject);

        PekReport ownReport = report(PekReportStatus.DRAFT, 1);
        reportRepository.saveAndFlush(ownReport);
        PekReport otherReport = new PekReport();
        otherReport.setCompanyId(otherCompany.getId());
        otherReport.setObjectId(otherObject.getId());
        otherReport.setProgramId(1L);
        otherReport.setPeriodType(PekPeriodType.QUARTER);
        otherReport.setReportYear(2026);
        otherReport.setReportQuarter(1);
        otherReport.setPeriodStart(LocalDate.of(2026, 1, 1));
        otherReport.setPeriodEnd(LocalDate.of(2026, 3, 31));
        otherReport.setStatus(PekReportStatus.DRAFT);
        otherReport.setCreatedBy(creator.getId());
        otherReport.computePeriodKey();
        reportRepository.saveAndFlush(otherReport);

        PekSchedulerRunLog runLog = scheduler.manualRun(reviewer.getId(), companyId);

        assertNotNull(runLog);
        assertEquals(1, runLog.getProcessedCount(), "only the report belonging to companyId must be processed");
    }

    @Test
    void schedulerRunEndpoint_withoutCompanyId_isRejected() throws Exception {
        mvc.perform(post("/api/pek/scheduler/run").with(as(reviewer)))
                .andExpect(status().isBadRequest());
    }

    // ---- item 6: collect() If-Match ------------------------------------------------------------

    @Test
    void collect_withStaleIfMatch_returns409VersionConflict() throws Exception {
        PekReport report = report(PekReportStatus.DRAFT, 1);
        reportRepository.saveAndFlush(report);

        mvc.perform(post("/api/pek/reports/" + report.getId() + "/collect").with(as(creator))
                        .header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
    }

    @Test
    void collect_withoutIfMatch_isRejectedAsVersionRequired() throws Exception {
        PekReport report = report(PekReportStatus.DRAFT, 1);
        reportRepository.saveAndFlush(report);

        mvc.perform(post("/api/pek/reports/" + report.getId() + "/collect").with(as(creator)))
                .andExpect(status().isBadRequest());
    }

    // ---- item 7: program readiness ------------------------------------------------------------

    @Test
    void notReadyProgram_cannotSubmitApproveOrActivate() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "P1-NOTREADY-%d", "name": "Не готова",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31",
                 "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId, System.nanoTime());
        MvcResult created = mvc.perform(post("/api/pek/programs").with(as(creator))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        Long programId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        // Blank out the control item's name directly (frequencyType is NOT NULL at the DB level,
        // so name is used instead) - an incomplete control item is a blocking readiness issue
        // (INCOMPLETE_CONTROL_ITEMS).
        PekProgramControlItem item = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0);
        item.setName("");
        controlItemRepository.saveAndFlush(item);

        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(creator))
                        .header("If-Match", "0"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_NOT_READY"));
    }

    // ---- item 8: maker-checker -------------------------------------------------------------------

    @Test
    void creatorCannotApproveOwnProgram() throws Exception {
        Long programId = createReadyProgram();
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(creator))
                        .header("If-Match", "0"))
                .andExpect(status().isOk());

        // creator also happens to hold a HEAD membership elsewhere would still be blocked - but
        // here creator's own ECOLOGIST role already lacks PEK_PROGRAM_APPROVE, so exercise the
        // maker-checker rule with a HEAD creator instead to prove it's the identity check, not the
        // role check, that fires.
        User headCreator = user("pek-p1-head-creator-", UserRole.HEAD);
        membership(headCreator, UserRole.HEAD);
        PekProgram ownProgram = new PekProgram();
        ownProgram.setCompanyId(companyId);
        ownProgram.setObjectId(objectId);
        ownProgram.setNumber("P1-SELF-" + System.nanoTime());
        ownProgram.setName("Своя программа");
        ownProgram.setValidFrom(LocalDate.of(2026, 1, 1));
        ownProgram.setValidUntil(LocalDate.of(2026, 12, 31));
        ownProgram.setStatus(PekProgramStatus.UNDER_REVIEW);
        ownProgram.setCreatedBy(headCreator.getId());
        programRepository.saveAndFlush(ownProgram);
        PekProgramControlItem item = new PekProgramControlItem();
        item.setProgramId(ownProgram.getId());
        item.setCode("CI-1");
        item.setName("Контроль");
        item.setControlType(PekControlType.EMISSION);
        item.setFrequencyType(PekFrequencyType.QUARTERLY);
        controlItemRepository.saveAndFlush(item);

        mvc.perform(post("/api/pek/programs/" + ownProgram.getId() + "/approve").with(as(headCreator))
                        .header("If-Match", "0"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_MAKER_CHECKER_VIOLATION"));
    }

    // ---- item 9: membership.roleCode is a real company-scoped permission ---------------------

    @Test
    void laboratoryMembership_cannotEditProgram_evenThoughViewIsAllowed() throws Exception {
        Long programId = createReadyProgram();

        mvc.perform(get("/api/pek/programs/" + programId).with(as(viewer)))
                .andExpect(status().isOk());

        mvc.perform(patch("/api/pek/programs/" + programId).with(as(viewer))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Попытка изменить\"}"))
                .andExpect(status().isForbidden());
    }

    /** The globally-held role (HEAD, passes the controller's @PreAuthorize(PEK_PROGRAM_APPROVE))
     *  is deliberately NOT the same as the company membership's roleCode (LABORATORY, below the
     *  REVIEW tier) - proves the service-level membership check is real and independent of the
     *  controller's role-only gate, not merely redundant with it. */
    @Test
    void headGloballyButLaboratoryMembership_cannotApproveInThisCompany() throws Exception {
        Long programId = createReadyProgram();
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(creator))
                        .header("If-Match", "0"))
                .andExpect(status().isOk());

        User globalHeadLocalLab = user("pek-p1-mixed-", UserRole.HEAD);
        membership(globalHeadLocalLab, UserRole.LABORATORY);

        mvc.perform(post("/api/pek/programs/" + programId + "/approve").with(as(globalHeadLocalLab))
                        .header("If-Match", "1"))
                .andExpect(status().isForbidden());
    }
}
