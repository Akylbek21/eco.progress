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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Iteration 3 of the PEK module overhaul: the sign workflow on {@link PekReportDocumentController}
 * / {@link PekReportSigningService}, reusing the project's real CMS/ЭЦП verification
 * (kz.eco.signature.SignatureVerificationService) exactly the way ProtocolService#sign does - see
 * PekReportSigningService's class javadoc. Uses {@link PekTestCmsSigner} to produce a real,
 * cryptographically valid CMS blob rather than a fake string, so this exercises the actual
 * BouncyCastle verification path.
 */
@SpringBootTest
@Transactional
class PekReportSigningApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;
    @Autowired private PekReportSignatureRepository signatureRepository;
    @Autowired private PekReportContentRevisionService contentRevisionService;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long reportId;
    private User head;
    private User otherCompanyUser;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Signing Test " + System.nanoTime());
        company.setBin(String.valueOf(800000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Signing Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Company otherCompany = new Company();
        otherCompany.setName("PEK Signing Other Company " + System.nanoTime());
        otherCompany.setBin(String.valueOf(900000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);

        head = user("pek-sign-head-", UserRole.HEAD);
        head.setIin("990101300123");
        userRepository.save(head);
        membership(companyId, head);
        otherCompanyUser = user("pek-sign-other-", UserRole.HEAD);
        membership(otherCompany.getId(), otherCompanyUser);

        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.APPROVED);
        report.setResponsibleUserId(head.getId());
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        reportId = report.getId();

        PekReportPlanFactRow row = new PekReportPlanFactRow();
        row.setReportId(reportId);
        row.setControlItemId(1L);
        row.setProgramIndicatorId(1L);
        row.setPlannedCount(1);
        row.setActualCount(1);
        row.setMissingCount(0);
        row.setCompletionPercent(BigDecimal.valueOf(100));
        row.setStatus(PekPlanFactRowStatus.COMPLETED);
        planFactRowRepository.saveAndFlush(row);
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

    private byte[] generatePdfAndGetBytes() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());
        MvcResult result = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getContentAsByteArray();
    }

    @Test
    void happyPathSignsAndTransitionsToSigned() throws Exception {
        byte[] pdf = generatePdfAndGetBytes();
        String cms = PekTestCmsSigner.signAttached(pdf);

        MvcResult result = mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        assertTrue((Boolean) JsonPath.read(result.getResponse().getContentAsString(), "$.data.verified"));

        PekReport report = reportRepository.findById(reportId).orElseThrow();
        assertEquals(PekReportStatus.SIGNED, report.getStatus());
        assertEquals(1, signatureRepository.findByReportIdOrderBySignedAtDesc(reportId).size());
    }

    @Test
    void tamperedCmsIsRejectedAndDoesNotPersistSignedState() throws Exception {
        byte[] pdf = generatePdfAndGetBytes();
        // Sign over DIFFERENT content than the actual PDF - the signature is cryptographically
        // valid but does not cover the report's real document, so verifyDocument must reject it.
        String cms = PekTestCmsSigner.signAttached("not the real pdf".getBytes());

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().is4xxClientError());

        PekReport report = reportRepository.findById(reportId).orElseThrow();
        assertEquals(PekReportStatus.APPROVED, report.getStatus());
        assertTrue(signatureRepository.findByReportIdOrderBySignedAtDesc(reportId).isEmpty());
    }

    @Test
    void garbageCmsIsRejected() throws Exception {
        generatePdfAndGetBytes();
        String garbage = Base64.getEncoder().encodeToString("garbage".getBytes());

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + garbage + "\"}"))
                .andExpect(status().is4xxClientError());

        assertEquals(PekReportStatus.APPROVED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }

    @Test
    void signingBlockedWhenReportNotApproved() throws Exception {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.COLLECTING);
        reportRepository.saveAndFlush(report);

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + Base64.getEncoder().encodeToString("x".getBytes()) + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NOT_APPROVED"));
    }

    @Test
    void signingBlockedWhenReadinessHasOpenBlockingIssues() throws Exception {
        generatePdfAndGetBytes();
        // Remove the responsible user - readiness flags RESPONSIBLE_REQUIRED as a blocking issue.
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setResponsibleUserId(null);
        reportRepository.saveAndFlush(report);

        String cms = PekTestCmsSigner.signAttached("irrelevant".getBytes());
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NOT_READY"));
    }

    @Test
    void postSignMutationAttemptsAreRejected() throws Exception {
        byte[] pdf = generatePdfAndGetBytes();
        String cms = PekTestCmsSigner.signAttached(pdf);
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());

        // Regeneration is blocked once SIGNED.
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DOCUMENT_LOCKED"));
    }

    @Test
    void availableActions_signIsFalseWhenNoPdfGeneratedYet() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.sign").value(false))
                .andExpect(jsonPath("$.data.availableActions.downloadPdf").value(false))
                .andExpect(jsonPath("$.data.availableActions.downloadDocx").value(false));
    }

    @Test
    void availableActions_downloadPdfAndSignBecomeTrueOncePdfIsGenerated() throws Exception {
        generatePdfAndGetBytes();

        mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.downloadPdf").value(true))
                .andExpect(jsonPath("$.data.availableActions.sign").value(true));
    }

    @Test
    void signIsRejectedServerSideWhenLatestVersionHasNoPdf() throws Exception {
        // Simulate a stale/never-generated PDF: no generate-pdf call happened, so
        // PekReportSigningService must refuse the sign attempt regardless of what the client sends.
        String cms = PekTestCmsSigner.signAttached("irrelevant".getBytes());
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NO_DOCUMENT"));
    }

    /** Module fix item 3: a PDF generated before the report's data changes (evidence, plan/fact,
     *  protocol-source rematch, permits, monitoring, ...) must never be signed or downloaded as if
     *  it were current - contentRevision (not the JPA version) is what catches this. */
    @Test
    void documentBecomesStale_afterContentRevisionBumps_signAndDownloadAreForbidden() throws Exception {
        generatePdfAndGetBytes();

        PekReport report = reportRepository.findById(reportId).orElseThrow();
        contentRevisionService.bump(report);

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_STALE"));

        String cms = PekTestCmsSigner.signAttached("irrelevant".getBytes());
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_STALE"));

        assertEquals(PekReportStatus.APPROVED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }

    /** Regenerating after a staleness bump must clear the problem - a fresh PDF always stamps the
     *  report's CURRENT contentRevision. */
    @Test
    void regeneratingAfterStaleness_makesDocumentSignableAgain() throws Exception {
        generatePdfAndGetBytes();
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        contentRevisionService.bump(report);

        byte[] freshPdf = generatePdfAndGetBytes();
        String cms = PekTestCmsSigner.signAttached(freshPdf);
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void downloadEndpointsAreCompanyScoped() throws Exception {
        generatePdfAndGetBytes();

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(otherCompanyUser)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/docx").with(as(otherCompanyUser)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions").with(as(otherCompanyUser)))
                .andExpect(status().isForbidden());
    }
}
