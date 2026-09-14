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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** availableActions must never say true for an action the real endpoint would then reject
 *  (module spec item 3: generateDocument/sign/manageExceedance/reviewExceedance keys). */
@SpringBootTest
@Transactional
class PekReportAvailableActionsTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long reportId;
    private User head;
    private User laboratory;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Actions Test " + System.nanoTime());
        company.setBin(String.valueOf(500000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Actions Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        head = user("pek-actions-head-", UserRole.HEAD);
        head.setIin("990101300123");
        userRepository.save(head);
        membership(companyId, head);
        laboratory = user("pek-actions-lab-", UserRole.LABORATORY);
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
        row.setCompletionPercent(java.math.BigDecimal.valueOf(100));
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

    @Test
    void approvedReport_headSeesSignAndGenerateDocumentTrue_andCanActuallyDoBoth() throws Exception {
        // sign=true additionally requires a generated PDF for the current report version (module
        // fix, PekReportService#availableActions) - without this, sign correctly reports false.
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());

        MvcResult result = mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.generateDocument"));
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.sign"));
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.manageExceedance"));
        assertEquals(false, JsonPath.read(body, "$.data.availableActions.reviewExceedance"),
                "no exceedance rows exist yet for this report");
        // Module fix: the new key set alongside the old ones - generateOfficialDocument/
        // signOfficialDocument mirror generateDocument/sign exactly at this status.
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.generateOfficialDocument"));
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.previewOfficialDocument"));
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.downloadOfficialDocument"));
        assertEquals(true, JsonPath.read(body, "$.data.availableActions.signOfficialDocument"));
        assertEquals(false, JsonPath.read(body, "$.data.availableActions.submit"),
                "submit only applies once SIGNED");
        assertEquals(false, JsonPath.read(body, "$.data.availableActions.accept"));
        assertEquals(false, JsonPath.read(body, "$.data.availableActions.reject"));

        // generateDocument=true must mean the real endpoint actually allows it.
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());

        // sign=true must mean the real endpoint actually allows it (once a PDF exists).
        byte[] pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String cms = PekTestCmsSigner.signAttached(pdf);
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void laboratoryRole_seesSignFalse_andRealEndpointRejectsIt() throws Exception {
        MvcResult result = mvc.perform(get("/api/pek/reports/" + reportId).with(as(laboratory)))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(false, JsonPath.read(result.getResponse().getContentAsString(), "$.data.availableActions.sign"));
        assertEquals(false, JsonPath.read(result.getResponse().getContentAsString(), "$.data.availableActions.manageExceedance"));

        // LABORATORY isn't in PEK_REPORT_SIGN's role set - the real endpoint must also reject.
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(laboratory))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"irrelevant\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void signedReport_generateDocumentBecomesFalse_andRealEndpointRejectsRegeneration() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());
        byte[] pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String cms = PekTestCmsSigner.signAttached(pdf);
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());

        MvcResult result = mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(false, JsonPath.read(result.getResponse().getContentAsString(), "$.data.availableActions.generateDocument"));
        assertEquals(false, JsonPath.read(result.getResponse().getContentAsString(), "$.data.availableActions.sign"));

        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DOCUMENT_LOCKED"));
    }

    /** submit=true at SIGNED must mean the real endpoint accepts it; accept=true/reject=true at
     *  SUBMITTED must mean those endpoints accept too - flags never lie about what would happen. */
    @Test
    void signedReport_submitBecomesTrue_andRealEndpointAcceptsThroughToAcceptOrReject() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(head)))
                .andExpect(status().isOk());
        byte[] pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(head)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        String cms = PekTestCmsSigner.signAttached(pdf);
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + cms + "\"}"))
                .andExpect(status().isOk());

        MvcResult signed = mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk()).andReturn();
        String signedBody = signed.getResponse().getContentAsString();
        assertEquals(true, JsonPath.read(signedBody, "$.data.availableActions.submit"));
        assertEquals(false, JsonPath.read(signedBody, "$.data.availableActions.accept"));
        assertEquals(false, JsonPath.read(signedBody, "$.data.availableActions.reject"));
        Long signedVersion = Long.valueOf(JsonPath.read(signedBody, "$.data.version").toString());

        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(head))
                        .header("If-Match", signedVersion))
                .andExpect(status().isOk());

        MvcResult submitted = mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk()).andReturn();
        String submittedBody = submitted.getResponse().getContentAsString();
        assertEquals(false, JsonPath.read(submittedBody, "$.data.availableActions.submit"));
        assertEquals(true, JsonPath.read(submittedBody, "$.data.availableActions.accept"));
        assertEquals(true, JsonPath.read(submittedBody, "$.data.availableActions.reject"));
        Long submittedVersion = Long.valueOf(JsonPath.read(submittedBody, "$.data.version").toString());

        mvc.perform(post("/api/pek/reports/" + reportId + "/accept").with(as(head))
                        .header("If-Match", submittedVersion))
                .andExpect(status().isOk());
    }

    @Test
    void draftReport_submitIsFalseAndRealEndpointRejectsIt() throws Exception {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.DRAFT);
        reportRepository.saveAndFlush(report);

        MvcResult result = mvc.perform(get("/api/pek/reports/" + reportId).with(as(head)))
                .andExpect(status().isOk()).andReturn();
        assertEquals(false, JsonPath.read(result.getResponse().getContentAsString(), "$.data.availableActions.submit"));

        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(head))
                        .header("If-Match", report.getVersion()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_INVALID_TRANSITION"));
    }
}
