package kz.eco.pek;

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
import kz.eco.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Official submission record (module spec P1, items 21-26): the manual attestation that a signed
 * report actually reached the regulator. Distinct from the internal SIGNED → SUBMITTED transition,
 * which {@link PekSubmissionLifecycleTest} covers.
 */
@SpringBootTest
@Transactional
class PekOfficialSubmissionApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekReportDocumentVersionRepository documentVersionRepository;

    private MockMvc mvc;
    private Long reportId;
    private Long companyId;
    private User admin;
    private User accountant;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        long nonce = System.nanoTime();

        Company company = new Company();
        company.setName("Submission API " + nonce);
        company.setBin(String.valueOf(700000000000L + Math.abs(nonce % 200000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Submission Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        admin = user(UserRole.ADMIN, ClientType.admin, nonce);
        accountant = user(UserRole.ACCOUNTANT, ClientType.staff, nonce + 1);

        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(object.getId());
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.SIGNED);
        report.setCreatedBy(admin.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        reportId = report.getId();

        PekReportDocumentVersion official = new PekReportDocumentVersion();
        official.setReportId(reportId);
        official.setVersion(1);
        official.setDocumentType(PekReportDocumentType.OFFICIAL);
        official.setSnapshotJson("{}");
        official.setContentHash("0".repeat(64));
        official.setGeneratedBy(admin.getId());
        official.setGeneratedAt(LocalDateTime.now());
        documentVersionRepository.saveAndFlush(official);
    }

    private User user(UserRole role, ClientType type, long nonce) {
        User user = new User();
        user.setEmail(role.name().toLowerCase() + "-sub-" + nonce + "@test.kz");
        user.setPasswordHash("x");
        user.setName("Тестовый " + role.name());
        user.setRole(role);
        user.setType(type);
        user.setStatus(UserStatus.active);
        return userRepository.saveAndFlush(user);
    }

    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
    }

    private long currentVersion() {
        return reportRepository.findById(reportId).orElseThrow().getVersion();
    }

    private String body(String method, String regNumber) {
        return """
                {"submissionMethod":"%s","registrationNumber":"%s",
                 "submissionComment":"Сдано лично в управление экологии"}
                """.formatted(method, regNumber);
    }

    /** Item 22: every required attribute is persisted. */
    @Test
    void recordSubmission_persistsAllRequisites() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("EGOV_PORTAL", "REG-2026-001")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submission.submissionMethod").value("EGOV_PORTAL"))
                .andExpect(jsonPath("$.data.submission.registrationNumber").value("REG-2026-001"))
                .andExpect(jsonPath("$.data.submission.submittedBy.id").value(admin.getId()))
                .andExpect(jsonPath("$.data.submission.submittedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.submission.createdAt").isNotEmpty());

        PekReport saved = reportRepository.findById(reportId).orElseThrow();
        assertEquals(PekSubmissionMethod.EGOV_PORTAL, saved.getSubmissionMethod());
        assertEquals("REG-2026-001", saved.getRegistrationNumber());
        assertEquals(admin.getId(), saved.getSubmittedBy());
        assertNotNull(saved.getSubmissionRecordedAt());
        assertNull(saved.getSubmissionUpdatedAt(), "updatedAt stays null until the first correction");
    }

    /** Item 23: recording a submission must not move the workflow status. */
    @Test
    void recordSubmission_doesNotChangeReportStatus() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PAPER", "REG-77")))
                .andExpect(status().isOk());

        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus(),
                "recording the filing is not the internal SIGNED -> SUBMITTED transition");
    }

    /** Item 26: the requisites come back on every subsequent read of the report. */
    @Test
    void recordedSubmission_isReturnedWhenReportIsReopened() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("EMAIL", "REG-REOPEN-1")))
                .andExpect(status().isOk());

        mvc.perform(get("/api/pek/reports/" + reportId).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submission.registrationNumber").value("REG-REOPEN-1"))
                .andExpect(jsonPath("$.data.submission.submissionMethod").value("EMAIL"));
    }

    /** A correction stamps updatedAt but keeps the original createdAt. */
    @Test
    void correctingRegistrationNumber_stampsUpdatedAt() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("EGOV_PORTAL", "WRONG-NUMBER")))
                .andExpect(status().isOk());
        LocalDateTime createdAt = reportRepository.findById(reportId).orElseThrow().getSubmissionRecordedAt();

        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("EGOV_PORTAL", "CORRECTED-NUMBER")))
                .andExpect(status().isOk());

        PekReport saved = reportRepository.findById(reportId).orElseThrow();
        assertEquals("CORRECTED-NUMBER", saved.getRegistrationNumber());
        assertEquals(createdAt, saved.getSubmissionRecordedAt(), "createdAt must not move");
        assertNotNull(saved.getSubmissionUpdatedAt());
    }

    /** Item 25: a report that was never signed cannot claim to have been filed. */
    @Test
    void recordSubmission_onUnsignedReport_isRejected() throws Exception {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.COLLECTING);
        reportRepository.saveAndFlush(report);

        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PAPER", "REG-BAD")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_INVALID_STATUS"));
    }

    /** Item 25: PEK_REPORT_SUBMIT is required - ACCOUNTANT holds only PEK_VIEW. */
    @Test
    void recordSubmission_withoutSubmitPermission_is403() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(accountant))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PAPER", "REG-403")))
                .andExpect(status().isForbidden());
    }

    /** Item 33: an unauthenticated caller gets 401, never data. */
    @Test
    void recordSubmission_unauthenticated_is401() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission")
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PAPER", "REG-401")))
                .andExpect(status().isUnauthorized());
    }

    /** Item 19: a stale If-Match must not silently overwrite. */
    @Test
    void recordSubmission_staleIfMatch_conflicts() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion() - 1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PAPER", "REG-STALE")))
                .andExpect(status().isConflict());

        assertNull(reportRepository.findById(reportId).orElseThrow().getRegistrationNumber(),
                "a rejected write must leave no trace");
    }

    @Test
    void recordSubmission_unknownMethod_is400() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("TELEPATHY", "REG-X")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_METHOD_INVALID"));
    }

    @Test
    void recordSubmission_futureDate_is400() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"submissionMethod":"PAPER","registrationNumber":"R",
                                 "submittedAt":"2099-01-01T10:00:00"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_DATE_IN_FUTURE"));
    }

    /** Item 24: the confirmation scan goes through the module's existing validated file storage. */
    @Test
    void uploadConfirmationFile_storesFileAndReturnsId() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "receipt.pdf", "application/pdf", "%PDF-1.4\n%test receipt".getBytes());

        String response = mvc.perform(multipart("/api/pek/reports/" + reportId + "/submission/file")
                        .file(file).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileId").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        String fileId = response.replaceAll(".*\"fileId\"\\s*:\\s*\"([^\"]+)\".*", "$1");

        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"submissionMethod":"EGOV_PORTAL","registrationNumber":"REG-FILE",
                                 "confirmationFileId":"%s"}
                                """.formatted(fileId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submission.confirmationFileId").value(fileId));
    }

    /** The receipt is addressed by REPORT id, so the company-scope check is the only way in -
     *  a raw stored-file id must not be a back door. */
    @Test
    void downloadConfirmationFile_returnsTheStoredScan() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "receipt.pdf", "application/pdf", "%PDF-1.4\nreceipt-body".getBytes());
        String uploaded = mvc.perform(multipart("/api/pek/reports/" + reportId + "/submission/file")
                        .file(file).with(as(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String fileId = uploaded.replaceAll(".*\"fileId\"\\s*:\\s*\"([^\"]+)\".*", "$1");

        mvc.perform(post("/api/pek/reports/" + reportId + "/submission").with(as(admin))
                        .header("If-Match", currentVersion())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"submissionMethod":"PAPER","registrationNumber":"REG-DL",
                                 "confirmationFileId":"%s"}
                                """.formatted(fileId)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/pek/reports/" + reportId + "/submission/file").with(as(admin)))
                .andExpect(status().isOk());
    }

    /** No receipt attached is a 404, not an empty 200 that looks like a valid empty file. */
    @Test
    void downloadConfirmationFile_whenNoneAttached_is404() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportId + "/submission/file").with(as(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void uploadConfirmationFile_withoutSubmitPermission_is403() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "receipt.pdf", "application/pdf", "%PDF-1.4\n".getBytes());

        mvc.perform(multipart("/api/pek/reports/" + reportId + "/submission/file")
                        .file(file).with(as(accountant)))
                .andExpect(status().isForbidden());
    }

    /** A report with no filing recorded must report submission as absent, not as an empty object -
     *  "not filed" and "filed with blank details" mean different things to an auditor. */
    @Test
    void reportWithoutSubmission_returnsNullSubmission() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submission").doesNotExist());
    }

    /** Items 13-14: the availableActions keys the frontend contract names must all be present. */
    @Test
    void reportAvailableActions_exposeContractKeys() throws Exception {
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.view").exists())
                .andExpect(jsonPath("$.data.availableActions.edit").exists())
                .andExpect(jsonPath("$.data.availableActions.collect").exists())
                .andExpect(jsonPath("$.data.availableActions.match").exists())
                .andExpect(jsonPath("$.data.availableActions.validate").exists())
                .andExpect(jsonPath("$.data.availableActions.generateDocument").exists())
                .andExpect(jsonPath("$.data.availableActions.sign").exists())
                .andExpect(jsonPath("$.data.availableActions.submitReview").exists())
                .andExpect(jsonPath("$.data.availableActions.returnForRevision").exists())
                .andExpect(jsonPath("$.data.availableActions.approve").exists())
                .andExpect(jsonPath("$.data.availableActions.archive").exists())
                .andExpect(jsonPath("$.data.availableActions.submit").exists());
    }
}
