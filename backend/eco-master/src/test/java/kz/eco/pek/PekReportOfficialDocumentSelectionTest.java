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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Blocker 3: OFFICIAL vs INTERNAL ПЭК report documents must never be confused. The critical case is
 * "OFFICIAL generated first, INTERNAL generated afterwards" - the old
 * {@code findTopByReportIdOrderByVersionDesc} would then hand the INTERNAL analytical document to
 * every download, readiness check and, worst of all, to signing.
 */
@SpringBootTest
@Transactional
class PekReportOfficialDocumentSelectionTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportSignatureRepository signatureRepository;
    @Autowired private PekReportDocumentVersionRepository versionRepository;
    @Autowired private PekReportContentRevisionService contentRevisionService;

    private MockMvc mvc;
    private Long reportId;
    private User head;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK DocType Test " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("DocType Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        head = new User();
        head.setEmail("pek-doctype-head-" + System.nanoTime() + "@test.kz");
        head.setPasswordHash("x");
        head.setName("Head");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        head.setIin("990101300123");
        userRepository.save(head);

        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(company.getId());
        m.setUserId(head.getId());
        m.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
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

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private void generateOfficialPdf() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());
    }

    private void generateInternalPdf() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-internal-pdf").with(as(head)))
                .andExpect(status().isOk());
    }

    private byte[] download(String suffix) throws Exception {
        MvcResult r = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf" + suffix)
                        .with(as(head)))
                .andExpect(status().isOk())
                .andReturn();
        return r.getResponse().getContentAsByteArray();
    }

    @Test
    void officialThenInternal_downloadWithoutDocumentTypeStillReturnsTheOfficialFile() throws Exception {
        generateOfficialPdf();
        var official = versionRepository
                .findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, PekReportDocumentType.OFFICIAL)
                .orElseThrow();
        generateInternalPdf();

        // Sanity: the newest row of ANY type is now the INTERNAL one - the exact trap.
        assertEquals(PekReportDocumentType.INTERNAL,
                versionRepository.findTopByReportIdOrderByVersionDesc(reportId).orElseThrow().getDocumentType());

        byte[] defaultDownload = download("");
        byte[] explicitOfficial = download("?documentType=OFFICIAL");
        assertArrayEquals(explicitOfficial, defaultDownload,
                "no documentType must mean OFFICIAL, not 'newest of any type'");

        byte[] internal = download("?documentType=INTERNAL");
        assertFalse(java.util.Arrays.equals(internal, defaultDownload),
                "the INTERNAL document is a different file");

        // The served official file is the one recorded on the OFFICIAL version row.
        assertNotNull(official.getPdfFileId());
    }

    @Test
    void versionListsAreSeparatePerDocumentType() throws Exception {
        generateOfficialPdf();
        generateInternalPdf();

        MvcResult officialList = mvc.perform(
                        get("/api/pek/reports/" + reportId + "/document/versions?documentType=OFFICIAL")
                                .with(as(head)))
                .andExpect(status().isOk()).andReturn();
        MvcResult internalList = mvc.perform(
                        get("/api/pek/reports/" + reportId + "/document/versions?documentType=INTERNAL")
                                .with(as(head)))
                .andExpect(status().isOk()).andReturn();

        List<String> officialTypes = JsonPath.read(officialList.getResponse().getContentAsString(),
                "$.data[*].documentType");
        List<String> internalTypes = JsonPath.read(internalList.getResponse().getContentAsString(),
                "$.data[*].documentType");
        assertEquals(1, officialTypes.size());
        assertEquals(1, internalTypes.size());
        assertEquals("OFFICIAL", officialTypes.get(0));
        assertEquals("INTERNAL", internalTypes.get(0));

        // No documentType == OFFICIAL only.
        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].documentType").value("OFFICIAL"));

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/latest").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentType").value("OFFICIAL"));
    }

    @Test
    void versionDownloadByIdRejectsAMismatchedDocumentType() throws Exception {
        generateOfficialPdf();
        generateInternalPdf();
        var internal = versionRepository
                .findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, PekReportDocumentType.INTERNAL)
                .orElseThrow();

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + internal.getId()
                        + "/download/pdf?documentType=OFFICIAL").with(as(head)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_TYPE_MISMATCH"));

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/" + internal.getId()
                        + "/download/pdf?documentType=INTERNAL").with(as(head)))
                .andExpect(status().isOk());
    }

    @Test
    void signingAlwaysSignsTheOfficialDocumentEvenWhenAnInternalOneIsNewer() throws Exception {
        generateOfficialPdf();
        var official = versionRepository
                .findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, PekReportDocumentType.OFFICIAL)
                .orElseThrow();
        generateInternalPdf();

        byte[] officialPdf = download("?documentType=OFFICIAL");
        String cms = PekTestCmsSigner.signAttached(officialPdf);

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());

        var signature = signatureRepository.findByReportIdOrderBySignedAtDesc(reportId).get(0);
        assertEquals(official.getId(), signature.getDocumentVersionId(),
                "the signature must be bound to the OFFICIAL document version");
        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }

    @Test
    void internalOnly_cannotBeSigned_andReportsNoOfficialDocument() throws Exception {
        generateInternalPdf();

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + java.util.Base64.getEncoder()
                                .encodeToString("x".getBytes()) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NO_OFFICIAL_DOCUMENT"));

        assertEquals(PekReportStatus.APPROVED, reportRepository.findById(reportId).orElseThrow().getStatus());
        assertTrue(signatureRepository.findByReportIdOrderBySignedAtDesc(reportId).isEmpty());
    }

    @Test
    void internalOnly_officialDownloadAndLatestReportNoOfficialDocument() throws Exception {
        generateInternalPdf();

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NO_OFFICIAL_DOCUMENT"));

        mvc.perform(get("/api/pek/reports/" + reportId + "/document/versions/latest").with(as(head)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NO_OFFICIAL_DOCUMENT"));
    }

    @Test
    void internalDocumentNeverEnablesTheOfficialWorkflowActions() throws Exception {
        generateInternalPdf();

        mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.sign").value(false))
                .andExpect(jsonPath("$.data.availableActions.downloadPdf").value(false));
    }

    @Test
    void staleOfficialDocumentCannotBeSigned() throws Exception {
        generateOfficialPdf();
        byte[] officialPdf = download("?documentType=OFFICIAL");
        String cms = PekTestCmsSigner.signAttached(officialPdf);

        // The report's content changes after the PDF was rendered - the official version is now
        // stale and must not be signable.
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        contentRevisionService.bump(report);

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().is4xxClientError());

        assertEquals(PekReportStatus.APPROVED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }
}
