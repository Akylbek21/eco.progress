package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.dto.PekApiDtos;
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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Iteration 2 of the PEK module overhaul: the corrective-action workflow on top of
 * {@link PekReportExceedance} - {@link PekExceedanceStatus#canTransitionTo} enforcement, assigning
 * a responsible person, attaching evidence, and the "close requires resolutionComment +
 * correctiveAction" rule. Exceedance ROWS themselves are created by
 * {@link PekPlanFactService#recompute} (covered by PekPlanFactExceedanceCalculationTest /
 * PekReportCollectionReconciliationTest, untouched here) - this test seeds one directly via the
 * repository and only exercises the workflow layer on top of it.
 */
@SpringBootTest
@Transactional
class PekExceedanceWorkflowTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long reportId;
    private User head;
    private User ecologist;
    private User laboratory;
    private User admin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Exceedance Test " + System.nanoTime());
        company.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 300000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Exceedance Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        head = user("pek-exc-head-", UserRole.HEAD);
        ecologist = user("pek-exc-ecologist-", UserRole.ECOLOGIST);
        laboratory = user("pek-exc-lab-", UserRole.LABORATORY);
        admin = user("pek-exc-admin-", UserRole.ADMIN);
        membership(companyId, head);
        membership(companyId, ecologist);
        membership(companyId, laboratory);

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
        reportId = report.getId();
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

    private void membership(Long companyId, User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private Long seedExceedance() {
        PekReportExceedance e = new PekReportExceedance();
        e.setReportId(reportId);
        e.setPlanFactRowId(1L);
        e.setProtocolId(1L);
        e.setProtocolResultId(System.nanoTime());
        e.setProgramIndicatorId(1L);
        e.setActualValue(BigDecimal.valueOf(10));
        e.setNormativeValue(BigDecimal.valueOf(5));
        e.setComparisonType(kz.eco.protocol.ComparisonType.LESS_OR_EQUAL);
        e.setExceedanceRatio(BigDecimal.valueOf(2));
        e.setSeverity(PekExceedanceSeverity.MEDIUM);
        e.setStatus(PekExceedanceStatus.OPEN);
        exceedanceRepository.saveAndFlush(e);
        return e.getId();
    }

    @Test
    void listsExceedancesForReport() throws Exception {
        seedExceedance();
        mvc.perform(get("/api/pek/reports/" + reportId + "/exceedances").with(as(head)))
                .andExpect(status().isOk());
    }

    @Test
    void assignResponsibleSetsFieldsAndAvailableActionsReflectStatus() throws Exception {
        Long id = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/assign").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"responsibleUserId": %d, "dueDate": "2026-06-01", "correctiveAction": "Заменить фильтр"}
                                """.formatted(ecologist.getId())))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.responsibleUserId").value(ecologist.getId()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.correctiveAction").value("Заменить фильтр"));
    }

    /** Module fix: assignResponsible previously relied only on the controller's
     *  PEK_REPORT_EDIT @PreAuthorize, which includes LABORATORY - a direct API call from
     *  LABORATORY could assign a responsible even though the UI never offers that option. */
    @Test
    void laboratoryCannotAssignResponsible_forbidden() throws Exception {
        Long id = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/assign").with(as(laboratory))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"responsibleUserId": %d}
                                """.formatted(ecologist.getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void headAndAdminCanAssignResponsible_success() throws Exception {
        Long headOwnedId = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + headOwnedId + "/assign").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"responsibleUserId": %d}
                                """.formatted(ecologist.getId())))
                .andExpect(status().isOk());

        Long adminOwnedId = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + adminOwnedId + "/assign").with(as(admin))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"responsibleUserId": %d}
                                """.formatted(ecologist.getId())))
                .andExpect(status().isOk());
    }

    /** Module fix item 6: a fileId that was never uploaded through /evidence-files for this
     *  exceedance must be rejected, not silently persisted as evidence. */
    @Test
    void attachingUnknownFileId_isRejectedAsNotFound() throws Exception {
        Long id = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/evidence").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileId": "never-uploaded-anywhere"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.code").value("PEK_EVIDENCE_FILE_NOT_FOUND"));
    }

    /** Module fix item 6: a fileId uploaded for a DIFFERENT exceedance (a different company's
     *  report, in this case) must never be attachable here just because the caller knows the id. */
    @Test
    void attachingFileUploadedForAnotherExceedance_isRejectedAsScopeMismatch() throws Exception {
        Long id = seedExceedance();

        // A second company/report/exceedance, with its own evidence file.
        Company otherCompany = new Company();
        otherCompany.setName("PEK Exceedance Other Company " + System.nanoTime());
        otherCompany.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        User otherHead = user("pek-exc-other-head-", UserRole.HEAD);
        membership(otherCompany.getId(), otherHead);

        PekReport otherReport = new PekReport();
        otherReport.setCompanyId(otherCompany.getId());
        otherReport.setObjectId(objectId);
        otherReport.setProgramId(1L);
        otherReport.setPeriodType(PekPeriodType.QUARTER);
        otherReport.setReportYear(2026);
        otherReport.setReportQuarter(2);
        otherReport.setPeriodStart(LocalDate.of(2026, 4, 1));
        otherReport.setPeriodEnd(LocalDate.of(2026, 6, 30));
        otherReport.setStatus(PekReportStatus.DRAFT);
        otherReport.setCreatedBy(otherHead.getId());
        otherReport.computePeriodKey();
        reportRepository.saveAndFlush(otherReport);

        PekReportExceedance otherExceedance = new PekReportExceedance();
        otherExceedance.setReportId(otherReport.getId());
        otherExceedance.setPlanFactRowId(1L);
        otherExceedance.setProtocolId(1L);
        otherExceedance.setProtocolResultId(System.nanoTime());
        otherExceedance.setProgramIndicatorId(1L);
        otherExceedance.setActualValue(BigDecimal.valueOf(10));
        otherExceedance.setNormativeValue(BigDecimal.valueOf(5));
        otherExceedance.setComparisonType(kz.eco.protocol.ComparisonType.LESS_OR_EQUAL);
        otherExceedance.setExceedanceRatio(BigDecimal.valueOf(2));
        otherExceedance.setSeverity(PekExceedanceSeverity.MEDIUM);
        otherExceedance.setStatus(PekExceedanceStatus.OPEN);
        exceedanceRepository.saveAndFlush(otherExceedance);

        String uploadResponse = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/pek/exceedances/" + otherExceedance.getId() + "/evidence-files")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "other-company-evidence.pdf", "application/pdf", "%PDF-1.4 other".getBytes()))
                        .with(as(otherHead))
                        .header("If-Match", "0"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String foreignFileId = JsonPath.read(uploadResponse, "$.data.fileId");

        // Try to attach the OTHER company's file to THIS exceedance.
        mvc.perform(post("/api/pek/exceedances/" + id + "/evidence").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileId": "%s"}
                                """.formatted(foreignFileId)))
                .andExpect(status().isForbidden())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.code").value("PEK_EVIDENCE_FILE_SCOPE_MISMATCH"));
    }

    @Test
    void invalidTransitionIsRejected() throws Exception {
        Long id = seedExceedance();
        // OPEN -> VERIFIED is not in ALLOWED_TRANSITIONS.
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "VERIFIED"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void closingWithoutResolutionCommentOrCorrectiveActionIsRejected() throws Exception {
        Long id = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "CONFIRMED"}
                                """))
                .andExpect(status().isOk());
        // CONFIRMED -> RESOLVED without correctiveAction/resolutionComment must fail.
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void fullWorkflowToClosedSucceedsWithResolutionContent() throws Exception {
        Long id = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/assign").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"correctiveAction": "Прочистить систему вентиляции"}
                                """))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "CONFIRMED"}
                                """))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "IN_PROGRESS"}
                                """))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "RESOLVED", "resolutionComment": "Проблема устранена, повторный замер в норме"}
                                """))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.status").value("RESOLVED"));
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "CLOSED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.status").value("CLOSED"));

        PekReportExceedance persisted = exceedanceRepository.findById(id).orElseThrow();
        assertEquals(PekExceedanceStatus.CLOSED, persisted.getStatus());
        assertFalse(persisted.getStatus().isOpen());
    }

    @Test
    void attachEvidenceStoresFileId() throws Exception {
        Long id = seedExceedance();
        // Module fix: attachEvidence now requires the fileId to have actually been uploaded for
        // THIS exceedance via /evidence-files first - an arbitrary client-supplied fileId is
        // rejected (see PekEvidenceFileAccessService).
        String uploadResponse = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/pek/exceedances/" + id + "/evidence-files")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "evidence.pdf", "application/pdf", "%PDF-1.4 evidence".getBytes()))
                        .with(as(head))
                        .header("If-Match", "0"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.version").exists())
                .andReturn().getResponse().getContentAsString();
        String fileId = JsonPath.read(uploadResponse, "$.data.fileId");
        Long versionAfterUpload = Long.valueOf(JsonPath.read(uploadResponse, "$.data.version").toString());

        mvc.perform(post("/api/pek/exceedances/" + id + "/evidence").with(as(head))
                        .header("If-Match", versionAfterUpload)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileId": "%s"}
                                """.formatted(fileId)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.data.evidenceFileIds[0]").value(fileId));
    }

    @Test
    void uploadingEvidenceFile_withoutIfMatch_isRejectedAsVersionRequired() throws Exception {
        Long id = seedExceedance();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/pek/exceedances/" + id + "/evidence-files")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "evidence.pdf", "application/pdf", "%PDF-1.4 evidence".getBytes()))
                        .with(as(head)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadingEvidenceFile_withStaleIfMatch_returns409() throws Exception {
        Long id = seedExceedance();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart("/api/pek/exceedances/" + id + "/evidence-files")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "evidence.pdf", "application/pdf", "%PDF-1.4 evidence".getBytes()))
                        .with(as(head))
                        .header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.code").value("PEK_EXCEEDANCE_VERSION_CONFLICT"));
    }

    @Test
    void staleVersionOnTransitionReturnsConflict() throws Exception {
        Long id = seedExceedance();
        mvc.perform(post("/api/pek/exceedances/" + id + "/transition").with(as(head))
                        .header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "UNDER_REVIEW"}
                                """))
                .andExpect(status().isConflict());
    }
}
