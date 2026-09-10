package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.pek.PekFrequencyType;
import kz.eco.pek.PekProgramStatus;
import kz.eco.pek.PekReport;
import kz.eco.pek.PekReportDocumentType;
import kz.eco.pek.PekReportDocumentVersionRepository;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.pek.PekReportRepository;
import kz.eco.pek.PekReportSignatureRepository;
import kz.eco.pek.PekReportStatus;
import kz.eco.pek.PekTestCmsSigner;
import kz.eco.user.User;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Blocker 5, readiness criterion: the whole chain end to end, through the real HTTP API, with no
 * mocked business logic and no manual database surgery to skip a step.
 *
 * <p>ПЭК programme -> creation-context finds an outstanding requirement -> from-pek creates a real
 * DRAFT protocol -> the protocol is filled in, made ready, approved and signed -> a ПЭК report is
 * created and collects that protocol -> the report is submitted, approved -> the OFFICIAL report
 * document is generated and cryptographically signed.
 */
@SpringBootTest
@Transactional
class PekProtocolFullFlowE2ETest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramTestFixture fixtures;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolService protocolService;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private PekReportSignatureRepository reportSignatureRepository;
    @Autowired private PekReportDocumentVersionRepository documentVersionRepository;

    private MockMvc mvc;
    private User author;      // ADMIN: creates the protocol and the report, does the lab work
    private User approver;    // DIRECTOR: maker-checker counterpart, approves and signs the report
    private PekProgramTestFixture.Fixture f;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        today = LocalDate.now();

        author = fixtures.user("e2e-author-", UserRole.ADMIN);
        approver = fixtures.user("e2e-approver-", UserRole.DIRECTOR);
        f = fixtures.standard(today.getYear(), author, PekFrequencyType.QUARTERLY, 1,
                PekProgramStatus.ACTIVE, true);
        fixtures.membership(f.companyId(), approver);

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(f.laboratoryId());
        employee.setUserId(author.getId());
        employee.setFullName(author.getName());
        employee.setEmail(author.getEmail());
        employee.setPosition("Исполнитель");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);

        authenticate(author);
    }

    private void authenticate(User u) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private long version(Long protocolId) {
        return protocolRepository.findById(protocolId).orElseThrow().getVersion();
    }

    @Test
    void pekRequirement_toSignedOfficialPekReport() throws Exception {
        // ---------- 1. ПЭК: find an outstanding requirement -----------------------------------
        MvcResult ctx = mvc.perform(get("/api/protocols/creation-context").with(as(author))
                        .param("companyId", String.valueOf(f.companyId()))
                        .param("objectId", String.valueOf(f.objectId()))
                        .param("date", today.toString()))
                .andExpect(status().isOk())
                .andReturn();
        String ctxBody = ctx.getResponse().getContentAsString();
        assertTrue((Boolean) JsonPath.read(ctxBody, "$.data.hasActiveProgram"));
        assertTrue((Boolean) JsonPath.read(ctxBody, "$.data.requirements[0].canCreate"));
        assertEquals("DUE", JsonPath.read(ctxBody, "$.data.requirements[0].status"));

        // ---------- 2. Create the protocol out of that requirement ----------------------------
        String createBody = """
                {"companyId":%d,"objectId":%d,"pekProgramId":%d,"pekMonitoringId":%d,
                 "pekControlItemId":%d,"monitoringPointId":%d,"protocolTemplateId":"%s",
                 "programIndicatorId":%d,"date":"%s"}
                """.formatted(f.companyId(), f.objectId(), f.programId(), f.monitoringId(),
                f.controlItemId(), f.pointId(),
                JsonPath.read(ctxBody, "$.data.requirements[0].protocolTemplateId").toString(),
                f.indicatorId(), today);
        MvcResult created = mvc.perform(post("/api/protocols/from-pek").with(as(author))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isOk())
                .andReturn();
        Long protocolId = Long.valueOf(
                JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
        assertEquals(ProtocolStatus.DRAFT, protocolRepository.findById(protocolId).orElseThrow().getStatus());
        assertEquals(f.indicatorId(),
                sourceRepository.findByProtocolIdOrderByCreatedAtAsc(protocolId).get(0).getProgramIndicatorId());

        // ---------- 3. Fill the protocol in ---------------------------------------------------
        mvc.perform(MockMvcRequestBuilders.patch("/api/protocols/" + protocolId + "/draft")
                        .with(as(author)).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":%d,"executorId":%d,"testingMethodDocument":"МУК 4.1.2468-09",
                                 "testingStartDate":"%s","testingEndDate":"%s","measurementDate":"%s"}
                                """.formatted(version(protocolId),
                                laboratoryEmployeeRepository.findAll().stream()
                                        .filter(e -> author.getId().equals(e.getUserId()))
                                        .findFirst().orElseThrow().getId(),
                                today, today, today)))
                .andExpect(status().isOk());

        mvc.perform(MockMvcRequestBuilders.patch("/api/protocols/" + protocolId + "/draft-results")
                        .with(as(author)).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":%d,"added":[{"clientRowId":"row-1","values":{
                                  "code":"0301","pollutantCode":"0301","indicatorName":"Азота диоксид",
                                  "normativeType":"PDK","normativeSubType":"MAX_ONE_TIME",
                                  "normativeValue":"0.2","unit":"мг/м³","comparisonType":"LESS_OR_EQUAL",
                                  "primaryReading":"0.13","measurementReadings":["0.13"]}}]}
                                """.formatted(version(protocolId))))
                .andExpect(status().isOk());

        // ---------- 4. Ready -> approve -> sign the protocol ----------------------------------
        protocolService.readyForApproval(protocolId, version(protocolId), author.getId());
        protocolService.approve(protocolId, version(protocolId), author.getId());
        assertEquals(ProtocolStatus.APPROVED, protocolRepository.findById(protocolId).orElseThrow().getStatus());

        byte[] protocolPdf = protocolService.downloadPdf(protocolId, author.getId()).inputStream().readAllBytes();
        String protocolCms = TestCmsSigner.signAttached(protocolPdf);
        mvc.perform(post("/api/protocols/" + protocolId + "/sign").with(as(author))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cmsSignatureBase64\":\"" + protocolCms + "\",\"version\":"
                                + version(protocolId) + "}"))
                .andExpect(status().isOk());
        assertEquals(ProtocolStatus.SIGNED, protocolRepository.findById(protocolId).orElseThrow().getStatus());

        // ---------- 5. Collect the signed protocol into a ПЭК report ---------------------------
        int quarter = (today.getMonthValue() - 1) / 3 + 1;
        MvcResult reportCreated = mvc.perform(post("/api/pek/reports").with(as(author))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId":%d,"objectId":%d,"periodType":"QUARTER","year":%d,
                                 "quarter":%d,"programId":%d,"collectImmediately":true}
                                """.formatted(f.companyId(), f.objectId(), today.getYear(), quarter,
                                f.programId())))
                .andExpect(status().isOk())
                .andReturn();
        Long reportId = Long.valueOf(
                JsonPath.read(reportCreated.getResponse().getContentAsString(), "$.data.id").toString());

        PekReport report = reportRepository.findById(reportId).orElseThrow();
        assertTrue(report.getLinkedProtocolCount() >= 1,
                "the ПЭК report must have collected the protocol created from its own requirement");
        assertTrue(sourceRepository.findByReportIdAndExcludedFalse(reportId).stream()
                        .anyMatch(s -> protocolId.equals(s.getProtocolId())),
                "the collected source must be exactly the protocol built from the ПЭК requirement");

        // ---------- 6. Submit for review, approve (maker-checker: a different user) ------------
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit-review").with(as(author))
                        .header("If-Match", reportRepository.findById(reportId).orElseThrow().getVersion()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/reports/" + reportId + "/approve").with(as(approver))
                        .header("If-Match", reportRepository.findById(reportId).orElseThrow().getVersion()))
                .andExpect(status().isOk());
        assertEquals(PekReportStatus.APPROVED, reportRepository.findById(reportId).orElseThrow().getStatus());

        // ---------- 7. Generate and sign the OFFICIAL ПЭК report document ----------------------
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(approver)))
                .andExpect(status().isOk());
        var officialVersion = documentVersionRepository
                .findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, PekReportDocumentType.OFFICIAL)
                .orElseThrow();

        MvcResult pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf")
                        .with(as(approver)))
                .andExpect(status().isOk())
                .andReturn();
        String reportCms = PekTestCmsSigner.signAttached(pdf.getResponse().getContentAsByteArray());
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(approver))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + reportCms + "\"}"))
                .andExpect(status().isOk());

        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
        var signature = reportSignatureRepository.findByReportIdOrderBySignedAtDesc(reportId).get(0);
        assertEquals(officialVersion.getId(), signature.getDocumentVersionId(),
                "the OFFICIAL document version is the one that got signed");

        // ---------- 8. The requirement is now reported as fulfilled ----------------------------
        MvcResult after = mvc.perform(get("/api/protocols/creation-context").with(as(author))
                        .param("companyId", String.valueOf(f.companyId()))
                        .param("objectId", String.valueOf(f.objectId()))
                        .param("date", today.toString()))
                .andExpect(status().isOk())
                .andReturn();
        String afterBody = after.getResponse().getContentAsString();
        assertEquals("COMPLETED", JsonPath.read(afterBody, "$.data.requirements[0].status"));
        assertEquals(1, (int) JsonPath.read(afterBody, "$.data.requirements[0].completedCount"));
    }
}
