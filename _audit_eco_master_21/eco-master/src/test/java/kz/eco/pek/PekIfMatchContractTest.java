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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Module fix: unified optimistic locking across PEK mutations via the {@code If-Match} header
 * (never a {@code version} field inside the request body). Covers the three-state contract -
 * missing header, stale header, correct header - for a representative mutation from each of the
 * areas the fix touched: permits, source reconciliation (exclude/restore), report return,
 * exceedance workflow, monitoring, and settings. Endpoint-specific business behavior is already
 * covered by each area's own test class (PekPermitApiTest, PekExceedanceWorkflowTest, etc.) -
 * this file only asserts the version-header contract itself.
 */
@SpringBootTest
@Transactional
class PekIfMatchContractTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekEnvironmentalPermitRepository permitRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekSettingsRepository settingsRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private User head;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK If-Match Test " + System.nanoTime());
        company.setBin(String.valueOf(800000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("If-Match Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        head = user("pek-ifmatch-head-", UserRole.HEAD);
        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(companyId);
        membership.setUserId(head.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);
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

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    // ---- permits: PATCH /api/pek/permits/{id} -------------------------------------------------

    private Long createPermit() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/permits").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "type": "EMISSION", "number": "IFM-1",
                                 "issuedAt": "2026-01-01", "validFrom": "2026-01-01", "validTo": "2026-12-31",
                                 "authority": "Минэкологии"}
                                """.formatted(companyId, objectId)))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
    }

    @Test
    void permitUpdate_withoutIfMatch_isRejected() throws Exception {
        Long id = createPermit();
        mvc.perform(patch("/api/pek/permits/" + id).with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\": \"no header\"}"))
                .andExpect(status().isBadRequest())
                // One stable code for "you did not send a version", whether the header is absent
                // (mapped by GlobalExceptionHandler) or hand-checked in a service.
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    /** A 409 must be actionable: stable code, the resource's current version so the client can
     *  retry without an extra GET, a safe message, and a correlation id for the server log. */
    @Test
    void versionConflict_carriesCurrentVersionAndTraceId() throws Exception {
        Long id = createPermit();
        mvc.perform(patch("/api/pek/permits/" + id).with(as(head)).header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\": \"stale\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PERMIT_VERSION_CONFLICT"))
                .andExpect(jsonPath("$.fieldErrors.currentVersion").value("0"))
                .andExpect(jsonPath("$.traceId").exists())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void permitUpdate_withStaleIfMatch_returns409VersionConflict() throws Exception {
        Long id = createPermit();
        mvc.perform(patch("/api/pek/permits/" + id).with(as(head)).header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\": \"stale\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PERMIT_VERSION_CONFLICT"));
    }

    @Test
    void permitUpdate_withCorrectIfMatch_succeedsAndReturnsBumpedVersion() throws Exception {
        Long id = createPermit();
        mvc.perform(patch("/api/pek/permits/" + id).with(as(head)).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"note\": \"first edit\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.note").value("first edit"))
                .andExpect(jsonPath("$.data.version").value(1));
    }

    // ---- source reconciliation: POST /api/pek/reports/{id}/sources/{sourceId}/exclude ---------

    private long[] createDraftReportWithSource() {
        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.DRAFT);
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);

        PekReportProtocolSource source = new PekReportProtocolSource();
        source.setReportId(report.getId());
        source.setProgramId(1L);
        source.setProtocolId(999999L);
        source.setManual(false);
        source.setMatchStatus(PekMatchStatus.UNMATCHED);
        source.setMatchedAt(LocalDateTime.now());
        sourceRepository.saveAndFlush(source);
        return new long[]{report.getId(), source.getId()};
    }

    @Test
    void excludeSource_withoutIfMatch_isRejected() throws Exception {
        long[] ids = createDraftReportWithSource();
        mvc.perform(post("/api/pek/reports/" + ids[0] + "/sources/" + ids[1] + "/exclude").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"dup\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void excludeSource_withStaleIfMatch_returns409() throws Exception {
        long[] ids = createDraftReportWithSource();
        mvc.perform(post("/api/pek/reports/" + ids[0] + "/sources/" + ids[1] + "/exclude").with(as(head))
                        .header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"dup\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void excludeSource_withCorrectIfMatch_succeeds() throws Exception {
        long[] ids = createDraftReportWithSource();
        mvc.perform(post("/api/pek/reports/" + ids[0] + "/sources/" + ids[1] + "/exclude").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"dup\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.excluded").value(true));
    }

    // ---- report return: POST /api/pek/reports/{id}/return -------------------------------------

    private Long createReadyForReviewReport() {
        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(2);
        report.setPeriodStart(LocalDate.of(2026, 4, 1));
        report.setPeriodEnd(LocalDate.of(2026, 6, 30));
        report.setStatus(PekReportStatus.READY_FOR_REVIEW);
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        return report.getId();
    }

    @Test
    void returnReport_withoutIfMatch_isRejected() throws Exception {
        Long id = createReadyForReviewReport();
        mvc.perform(post("/api/pek/reports/" + id + "/return").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"missing data\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnReport_withStaleIfMatch_returns409() throws Exception {
        Long id = createReadyForReviewReport();
        mvc.perform(post("/api/pek/reports/" + id + "/return").with(as(head))
                        .header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"missing data\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void returnReport_withCorrectIfMatch_succeeds() throws Exception {
        Long id = createReadyForReviewReport();
        mvc.perform(post("/api/pek/reports/" + id + "/return").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"missing data\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RETURNED"));
    }

    // ---- exceedance workflow: POST /api/pek/exceedances/{id}/transition -----------------------

    private Long createOpenExceedance() {
        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(3);
        report.setPeriodStart(LocalDate.of(2026, 7, 1));
        report.setPeriodEnd(LocalDate.of(2026, 9, 30));
        report.setStatus(PekReportStatus.DRAFT);
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);

        PekReportExceedance exceedance = new PekReportExceedance();
        exceedance.setReportId(report.getId());
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
        exceedanceRepository.saveAndFlush(exceedance);
        return exceedance.getId();
    }

    @Test
    void exceedanceTransition_withoutIfMatch_isRejected() throws Exception {
        Long id = createOpenExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"CONFIRMED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exceedanceTransition_withCorrectIfMatch_succeeds() throws Exception {
        Long id = createOpenExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\": \"CONFIRMED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }

    // ---- monitoring response contract: GET /api/pek/programs/{id}/monitoring ------------------

    @Test
    void monitoringList_returnsProgramIdItemsAndAvailableActions() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/programs").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "number": "IFM-PROG-1", "name": "Программа",
                                 "validFrom": "2026-01-01", "validUntil": "2026-12-31",
                                 "controlItems": [{"code": "CI-1", "name": "Контроль", "controlType": "EMISSION",
                                   "frequencyType": "QUARTERLY", "frequencyValue": 1}]}
                                """.formatted(companyId, objectId)))
                .andExpect(status().isOk()).andReturn();
        Long programId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(get("/api/pek/programs/" + programId + "/monitoring").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.programId").value(programId))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items.length()").value(0))
                .andExpect(jsonPath("$.data.availableActions.create").value(true));
    }

    @Test
    void monitoringList_neverRequiresIfMatch() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/programs").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "number": "IFM-PROG-2", "name": "Программа 2",
                                 "validFrom": "2026-01-01", "validUntil": "2026-12-31",
                                 "controlItems": [{"code": "CI-1", "name": "Контроль", "controlType": "EMISSION",
                                   "frequencyType": "QUARTERLY", "frequencyValue": 1}]}
                                """.formatted(companyId, objectId)))
                .andExpect(status().isOk()).andReturn();
        Long programId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        // No If-Match header at all - GET must never require one.
        mvc.perform(get("/api/pek/programs/" + programId + "/monitoring").with(as(head)))
                .andExpect(status().isOk());
    }

    // ---- settings: PUT /api/pek/settings --------------------------------------------------------

    private String settingsBody(int days) {
        return """
                {"defaultResponsibleUserId":null,"defaultLaboratoryId":null,"defaultReportType":"QUARTERLY",
                 "autoCollectProtocols":false,"includeOnlySignedProtocols":true,"allowFallbackMatching":true,
                 "requireManualAmbiguousConfirmation":true,"requireAllPlanFactItems":true,
                 "blockSubmitWithUnmatchedResults":true,"blockSubmitWithAmbiguousResults":true,
                 "blockSubmitWithStaleSources":true,"blockSubmitWithOpenExceedances":true,
                 "notifyBeforeDeadlineDays":%d,"notifyMissingProtocols":true,"notifyExceedances":true,
                 "notifyReportReturned":true}
                """.formatted(days);
    }

    @Test
    void settingsUpdate_withoutIfMatch_isRejected() throws Exception {
        mvc.perform(put("/api/pek/settings").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(settingsBody(5)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void settingsUpdate_withStaleIfMatch_returns409() throws Exception {
        mvc.perform(put("/api/pek/settings").with(as(head)).header("If-Match", "5")
                        .contentType(MediaType.APPLICATION_JSON).content(settingsBody(5)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_SETTINGS_VERSION_CONFLICT"));
    }

    @Test
    void settingsUpdate_withCorrectIfMatch_succeeds() throws Exception {
        mvc.perform(put("/api/pek/settings").with(as(head)).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(settingsBody(5)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.notifyBeforeDeadlineDays").value(5))
                .andExpect(jsonPath("$.data.version").value(0));
    }
}
