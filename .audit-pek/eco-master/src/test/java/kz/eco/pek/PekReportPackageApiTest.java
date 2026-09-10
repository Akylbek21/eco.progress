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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Module fix: unified /api/pek/reports/{id}/package(/generate|/download) response DTO
 *  (documentVersion/sourceContentRevision/downloadAvailable/availableActions), and the staleness
 *  guard on download (item 3: a package generated before the report's content changed must not be
 *  downloadable as if it were current). */
@SpringBootTest
@Transactional
class PekReportPackageApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekReportContentRevisionService contentRevisionService;

    private MockMvc mvc;
    private Long reportId;
    private User head;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Package Test " + System.nanoTime());
        company.setBin(String.valueOf(400000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        Long companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Package Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        Long objectId = object.getId();

        head = user("pek-pkg-head-", UserRole.HEAD);
        membership(companyId, head);

        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("ПЭК-PKG-001");
        program.setName("Программа для комплекта");
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setCreatedBy(head.getId());
        programRepository.saveAndFlush(program);

        PekProgramMonitoring monitoring = new PekProgramMonitoring();
        monitoring.setProgramId(program.getId());
        monitoring.setMonitoringType(PekMonitoringType.EMISSION_SOURCE);
        monitoring.setName("Выбросы");
        monitoring.setMethodology("МУК 4.1");
        monitoring.setFrequencyType(PekFrequencyType.QUARTERLY);
        monitoring.setPlannedCount(4);
        monitoring.setActive(true);
        monitoring.setControlItemIds(new LinkedHashSet<>());
        monitoringRepository.saveAndFlush(monitoring);

        PekReport report = new PekReport();
        report.setCompanyId(companyId);
        report.setObjectId(objectId);
        report.setProgramId(program.getId());
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.COLLECTING);
        report.setResponsibleUserId(head.getId());
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

    @Test
    void generate_thenGet_thenDownload_roundTrips() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.reportId").value(reportId))
                .andExpect(jsonPath("$.data.documentVersion").value(1))
                .andExpect(jsonPath("$.data.sourceContentRevision").exists())
                .andExpect(jsonPath("$.data.files").isArray())
                .andExpect(jsonPath("$.data.missingFields").isArray())
                .andExpect(jsonPath("$.data.generatedAt").exists())
                .andExpect(jsonPath("$.data.generatedBy").value(head.getId()))
                .andExpect(jsonPath("$.data.downloadAvailable").value(true))
                .andExpect(jsonPath("$.data.availableActions.generatePackage").value(true))
                .andExpect(jsonPath("$.data.availableActions.downloadPackage").value(true))
                .andExpect(jsonPath("$.data.version").exists());

        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1));

        mvc.perform(get("/api/pek/reports/" + reportId + "/package/download").with(as(head)))
                .andExpect(status().isOk());
    }

    /** Module fix item 3: a package generated before a later report-content change must not be
     *  downloadable, and availableActions.downloadPackage must honestly reflect that. */
    @Test
    void download_afterContentRevisionBump_isRejectedAsStale() throws Exception {
        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head)))
                .andExpect(status().isOk());

        PekReport report = reportRepository.findById(reportId).orElseThrow();
        contentRevisionService.bump(report);

        mvc.perform(get("/api/pek/reports/" + reportId + "/package").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.downloadPackage").value(false));

        mvc.perform(get("/api/pek/reports/" + reportId + "/package/download").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_STALE"));
    }

    @Test
    void generate_withNoMonitoringDirections_isRejected() throws Exception {
        monitoringRepository.deleteAll(monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(
                reportRepository.findById(reportId).orElseThrow().getProgramId()));

        mvc.perform(post("/api/pek/reports/" + reportId + "/package/generate").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_MONITORING_EMPTY"));
    }
}
