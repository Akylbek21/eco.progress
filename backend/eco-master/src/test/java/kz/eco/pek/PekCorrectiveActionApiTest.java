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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** POST/PUT/DELETE/transition /api/pek/exceedances/{id}/corrective-actions[/{actionId}] - If-Match
 *  is the parent exceedance's version (same convention as monitoring's If-Match being the parent
 *  program's version), tenant-scoped, history-logged, and returns the current version. */
@SpringBootTest
@Transactional
class PekCorrectiveActionApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;
    @Autowired private PekExceedanceCorrectiveActionRepository correctiveActionRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long reportId;
    private Long exceedanceId;
    private User head;
    private User laboratory;
    private User outsider;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Corrective Action Test " + System.nanoTime());
        company.setBin(String.valueOf(800000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Corrective Action Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        head = user("pek-ca-head-", UserRole.HEAD);
        laboratory = user("pek-ca-lab-", UserRole.LABORATORY);
        membership(companyId, head);
        membership(companyId, laboratory);

        outsider = user("pek-ca-outsider-", UserRole.HEAD);
        // no membership - used for 403 tests

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
        exceedanceId = e.getId();
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

    private String createJson() {
        return """
                {"description": "Устранить утечку", "dueDate": "2026-06-01"}
                """;
    }

    @Test
    void createUpdateTransitionDelete_roundTrips() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("Устранить утечку"))
                .andExpect(jsonPath("$.data.status").value("PLANNED"))
                .andExpect(jsonPath("$.data.availableActions.edit").value(true))
                .andReturn();
        Long actionId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(get("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(actionId));

        // Creating the action bumped the exceedance's version to 1.
        mvc.perform(put("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId).with(as(head))
                        .header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"description": "Устранить утечку (обновлено)"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("Устранить утечку (обновлено)"));

        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId + "/transition")
                        .with(as(head))
                        .header("If-Match", "2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "IN_PROGRESS"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));

        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId + "/transition")
                        .with(as(head))
                        .header("If-Match", "3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "DONE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DONE"))
                .andExpect(jsonPath("$.data.completedAt").exists());

        assertTrue(correctiveActionRepository.findByIdAndExceedanceId(actionId, exceedanceId).isPresent());

        mvc.perform(delete("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId).with(as(head))
                        .header("If-Match", "4"))
                .andExpect(status().isOk());
        assertTrue(correctiveActionRepository.findByIdAndExceedanceId(actionId, exceedanceId).isEmpty());
    }

    @Test
    void createWithoutIfMatch_isRejectedAsVersionRequired() throws Exception {
        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    @Test
    void createWithStaleIfMatch_returns409() throws Exception {
        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(head))
                        .header("If-Match", "999")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_EXCEEDANCE_VERSION_CONFLICT"));
    }

    @Test
    void createByLaboratoryRole_isForbidden() throws Exception {
        // LABORATORY may add evidence but not plan/track corrective actions (same gate as
        // assignResponsible: reviewer roles or ECOLOGIST only).
        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(laboratory))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    void createForExceedanceOutsideCallersCompany_isForbidden() throws Exception {
        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(outsider))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateUnknownAction_returns404() throws Exception {
        mvc.perform(put("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/999999999").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"description": "x"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void transitionToInvalidTarget_returns409() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isOk()).andReturn();
        Long actionId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        // PLANNED -> DONE is not an allowed direct transition (must go through IN_PROGRESS first).
        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId + "/transition")
                        .with(as(head))
                        .header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "DONE"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_CORRECTIVE_ACTION_INVALID_TRANSITION"));
    }

    @Test
    void deleteWithStaleIfMatch_returns409() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions").with(as(head))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson()))
                .andExpect(status().isOk()).andReturn();
        Long actionId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(delete("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId).with(as(head))
                        .header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_EXCEEDANCE_VERSION_CONFLICT"));
    }
}
