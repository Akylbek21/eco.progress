package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static kz.eco.pek.PekScenarioSupport.as;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** POST /api/pek/reports/{id}/submit with the official submission body (SIGNED -> SUBMITTED). */
@SpringBootTest
@Transactional
class PekOfficialSubmitApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportWorkflowHistoryRepository historyRepository;
    @Autowired private PekReportContentRevisionService contentRevisionService;

    private MockMvc mvc;
    private PekScenarioSupport.Tenant tenant;
    private User signer;
    private Long reportId;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tenant = support.tenant("submit");
        signer = tenant.checker();
        signer.setIin("990101300123"); // matches the PekTestCmsSigner test certificate
        PekReport report = new PekReport();
        report.setCompanyId(tenant.companyId());
        report.setObjectId(tenant.objectId());
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(3);
        report.setPeriodStart(LocalDate.of(2026, 7, 1));
        report.setPeriodEnd(LocalDate.of(2026, 9, 30));
        report.setStatus(PekReportStatus.APPROVED);
        report.setResponsibleUserId(tenant.maker().getId());
        report.setCreatedBy(tenant.maker().getId());
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
        row.setCompletionPercent(java.math.BigDecimal.valueOf(100));
        row.setStatus(PekPlanFactRowStatus.COMPLETED);
        planFactRowRepository.saveAndFlush(row);
    }

    private void generateAndSign() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(signer)))
                .andExpect(status().isOk());
        byte[] pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(signer)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(signer))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + PekTestCmsSigner.signAttached(pdf) + "\"}"))
                .andExpect(status().isOk());
    }

    private long version() {
        return reportRepository.findById(reportId).orElseThrow().getVersion();
    }

    private String uploadReceipt(Long targetReportId) throws Exception {
        String response = mvc.perform(multipart("/api/pek/reports/" + targetReportId + "/submission/file")
                        .file(new MockMultipartFile("file", "receipt.pdf", "application/pdf",
                                "%PDF-1.4\n%receipt".getBytes()))
                        .with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.data.fileId").toString();
    }

    private static String nowWithOffset() {
        return OffsetDateTime.now(ZoneOffset.ofHours(5)).toString();
    }

    private MockHttpServletRequestBuilder submit(long ifMatch, String body) {
        MockHttpServletRequestBuilder b = post("/api/pek/reports/" + reportId + "/submit")
                .with(as(tenant.maker())).header("If-Match", String.valueOf(ifMatch));
        return body == null ? b : b.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void successfulSubmission_roundTripsAllRequisites_andWritesHistory() throws Exception {
        generateAndSign();
        String fileId = uploadReceipt(reportId);
        String submittedAt = nowWithOffset();
        String body = """
                {"submittedAt":"%s","registrationNumber":"KZ-PEK-2026-00123","submissionMethod":"ECO_PORTAL",
                 "confirmationFileId":"%s","comment":"Принято порталом"}
                """.formatted(submittedAt, fileId);

        String detail = mvc.perform(get("/api/pek/reports/" + reportId).with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        assertEquals(true, JsonPath.read(detail, "$.data.availableActions.submit"));

        mvc.perform(submit(version(), body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        LocalDateTime expectedLocal = OffsetDateTime.parse(submittedAt)
                .atZoneSameInstant(java.time.ZoneId.systemDefault()).toLocalDateTime();
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(tenant.checker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.submission.submissionMethod").value("ECO_PORTAL"))
                .andExpect(jsonPath("$.data.submission.registrationNumber").value("KZ-PEK-2026-00123"))
                .andExpect(jsonPath("$.data.submission.submissionComment").value("Принято порталом"))
                .andExpect(jsonPath("$.data.submission.confirmationFileId").value(fileId))
                .andExpect(jsonPath("$.data.submission.submittedAt").value(org.hamcrest.Matchers.startsWith(
                        expectedLocal.withNano(0).toString().substring(0, 19))))
                .andExpect(jsonPath("$.data.submission.submittedBy.id").value(tenant.maker().getId()))
                .andExpect(jsonPath("$.data.availableActions.submit").value(false));
        mvc.perform(get("/api/pek/reports/" + reportId + "/submission/file").with(as(tenant.checker())))
                .andExpect(status().isOk());

        var history = historyRepository.findAll().stream()
                .filter(h -> reportId.equals(h.getReportId()) && "SUBMIT".equals(h.getAction()))
                .toList();
        assertEquals(1, history.size());
        assertTrue(history.get(0).getComment().contains("KZ-PEK-2026-00123"));
        assertFalse(history.get(0).getComment().contains("MII"), "no signature/CMS content in audit");
    }

    @Test
    void bodyLessLegacyCall_isRejectedWithContractError() throws Exception {
        generateAndSign();
        mvc.perform(submit(version(), null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_DETAILS_REQUIRED"));
        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
        assertNull(reportRepository.findById(reportId).orElseThrow().getSubmittedAt());
    }

    @Test
    void unsignedReport_cannotBeSubmitted() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(signer)))
                .andExpect(status().isOk());
        // APPROVED but not signed: no transition to SUBMITTED.
        mvc.perform(submit(version(), "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"EMAIL\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_INVALID_TRANSITION"));
        // SIGNED status without a verified signature on the current official document.
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.SIGNED);
        reportRepository.saveAndFlush(report);
        mvc.perform(submit(version(), "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"EMAIL\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_NOT_SIGNED"));
    }

    @Test
    void staleOfficialDocument_cannotBeSubmitted() throws Exception {
        generateAndSign();
        contentRevisionService.bump(reportId);
        String detail = mvc.perform(get("/api/pek/reports/" + reportId).with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        assertEquals(false, JsonPath.read(detail, "$.data.availableActions.submit"));
        mvc.perform(submit(version(), "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"EMAIL\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_STALE"));
    }

    @Test
    void foreignConfirmationFile_isRefused() throws Exception {
        generateAndSign();
        // A receipt uploaded for another company's report.
        PekScenarioSupport.Tenant other = support.tenant("foreign-file");
        PekReport foreign = new PekReport();
        foreign.setCompanyId(other.companyId());
        foreign.setObjectId(other.objectId());
        foreign.setProgramId(2L);
        foreign.setPeriodType(PekPeriodType.QUARTER);
        foreign.setReportYear(2026);
        foreign.setReportQuarter(3);
        foreign.setPeriodStart(LocalDate.of(2026, 7, 1));
        foreign.setPeriodEnd(LocalDate.of(2026, 9, 30));
        foreign.setStatus(PekReportStatus.SIGNED);
        foreign.setCreatedBy(other.maker().getId());
        foreign.computePeriodKey();
        reportRepository.saveAndFlush(foreign);
        String foreignFile = mvc.perform(multipart("/api/pek/reports/" + foreign.getId() + "/submission/file")
                        .file(new MockMultipartFile("file", "r.pdf", "application/pdf", "%PDF-1.4\n%x".getBytes()))
                        .with(as(other.maker())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String foreignFileId = JsonPath.read(foreignFile, "$.data.fileId").toString();

        mvc.perform(submit(version(), """
                        {"submittedAt":"%s","submissionMethod":"EMAIL","confirmationFileId":"%s"}
                        """.formatted(nowWithOffset(), foreignFileId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_FILE_FOREIGN"));
        mvc.perform(submit(version(), """
                        {"submittedAt":"%s","submissionMethod":"EMAIL","confirmationFileId":"no-such-file"}
                        """.formatted(nowWithOffset())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_FILE_NOT_FOUND"));
        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }

    @Test
    void repeatedSubmission_isRejected() throws Exception {
        generateAndSign();
        String body = "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"PAPER\"}";
        mvc.perform(submit(version(), body)).andExpect(status().isOk());
        mvc.perform(submit(version(), body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_INVALID_TRANSITION"));
    }

    @Test
    void versionConflict_andMissingIfMatch() throws Exception {
        generateAndSign();
        String body = "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"PAPER\"}";
        mvc.perform(submit(version() + 7, body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void noPermission_andForeignTenant_areForbidden() throws Exception {
        generateAndSign();
        String body = "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"PAPER\"}";
        User lab = support.user("pek-lab-", UserRole.LABORATORY);
        support.membership(tenant.companyId(), lab);
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(lab))
                        .header("If-Match", String.valueOf(version()))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        PekScenarioSupport.Tenant other = support.tenant("foreign");
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(other.maker()))
                        .header("If-Match", String.valueOf(version()))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }

    @Test
    void invalidRequisites_areFieldValidated() throws Exception {
        generateAndSign();
        mvc.perform(submit(version(), "{\"submittedAt\":\"" + nowWithOffset() + "\",\"submissionMethod\":\"CARRIER_PIGEON\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(submit(version(), "{\"submissionMethod\":\"ECO_PORTAL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.submittedAt").exists())
                .andExpect(jsonPath("$.fieldErrors.registrationNumber").exists());
        mvc.perform(submit(version(), "{\"submittedAt\":\"2999-01-01T10:00:00+05:00\",\"submissionMethod\":\"EMAIL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.submittedAt").exists());
        mvc.perform(submit(version(), "{\"submittedAt\":\"2020-01-01T10:00:00+05:00\",\"submissionMethod\":\"EMAIL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.submittedAt").exists());
        mvc.perform(submit(version(), "{\"submittedAt\":\"вчера\",\"submissionMethod\":\"EMAIL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_SUBMISSION_DATE_INVALID"));
        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }
}
