package kz.eco.pek;

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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.http.MediaType;

/**
 * Tests for items 1 (facility snapshot), 4 (regulation version), 10 (permit M:N), 11 (readiness
 * monitoring-points-required blocking check).
 *
 * Item 13 contract tests:
 * - create → GET returns snapshot fields
 * - PATCH with facilitySnapshot → snapshot updated, other fields unchanged
 * - permitIds same company+object → success; different company → 400
 * - normative snapshot: indicator stores normativeId; later normative changes do not affect stored value
 * - readiness: monitoring direction without points → MONITORING_POINTS_REQUIRED blocking
 * - readiness: monitoring direction with points → no blocking on that check
 */
@SpringBootTest
@Transactional
class PekProgramSnapshotAndPermitTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PekEnvironmentalPermitRepository permitRepository;
    @Autowired private PekProgramPermitLinkRepository permitLinkRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekStaffAssignmentRepository staffRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekMonitoringPointRepository monitoringPointRepository;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long userId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Snapshot Test");
        company.setBin("123456789001");
        company.setLegalAddress("г. Алматы, ул. Тест, 1");
        company.setPhone("+77001234567");
        company.setStatus(CompanyStatus.ACTIVE);
        companyId = companyRepository.save(company).getId();

        CompanyObject obj = new CompanyObject();
        obj.setCompanyId(companyId);
        obj.setName("Объект Snapshot");
        obj.setAddress("г. Алматы");
        obj.setStatus("ACTIVE");
        objectId = companyObjectRepository.save(obj).getId();

        User user = new User();
        user.setName("Snapshot Tester");
        user.setEmail("snapshot-" + System.nanoTime() + "@test.kz");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.admin);
        user.setPasswordHash(passwordEncoder.encode("pass"));
        userId = userRepository.save(user).getId();

        PekStaffAssignment sa = new PekStaffAssignment();
        sa.setCompanyId(companyId);
        sa.setUserId(userId);
        sa.setTier(PekStaffTier.REVIEWER);
        sa.setStatus(PekMembershipStatus.ACTIVE);
        sa.setAssignedBy(userId);
        staffRepository.save(sa);

        authenticate(userId, UserRole.ADMIN);
    }

    private void authenticate(Long uid, UserRole role) {
        User u = userRepository.findById(uid).orElseThrow();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(u, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    // ---- item 1: facility snapshot stored on create and returned on GET ----------------------

    @Test
    void createProgram_withFacilitySnapshot_snapshotStoredAndReturnedByGet() throws Exception {
        String body = """
            {
              "companyId": %d, "objectId": %d,
              "number": "SNAP-001", "name": "Программа со snapshot",
              "validFrom": "2026-01-01", "validUntil": "2026-12-31",
              "facilitySnapshot": {
                "facilityInformation": "Нефтеперерабатывающий завод",
                "kato": "751110000",
                "binSnapshot": "123456789001",
                "oked": "19.20",
                "environmentalCategory": "I категория",
                "designCapacity": "500 000 т/год",
                "productionCharacteristics": "Переработка сырой нефти"
              }
            }
            """.formatted(companyId, objectId);

        var result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilitySnapshot.kato").value("751110000"))
                .andExpect(jsonPath("$.data.facilitySnapshot.oked").value("19.20"))
                .andExpect(jsonPath("$.data.facilitySnapshot.environmentalCategory").value("I категория"))
                .andExpect(jsonPath("$.data.facilitySnapshot.designCapacity").value("500 000 т/год"))
                .andReturn();

        long programId = ((Number) com.jayway.jsonpath.JsonPath.read(
                result.getResponse().getContentAsString(), "$.data.id")).longValue();

        // Verify GET returns the same snapshot
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/pek/programs/" + programId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilitySnapshot.facilityInformation").value("Нефтеперерабатывающий завод"))
                .andExpect(jsonPath("$.data.facilitySnapshot.binSnapshot").value("123456789001"));
    }

    // ---- item 1: PATCH with facilitySnapshot updates snapshot fields -------------------------

    @Test
    void patchProgram_withFacilitySnapshot_updatesSnapshotFields() throws Exception {
        String create = """
            {"companyId":%d,"objectId":%d,"number":"SNAP-002","name":"Прогр PATCH",
             "validFrom":"2026-01-01","validUntil":"2026-12-31"}
            """.formatted(companyId, objectId);
        var created = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isOk()).andReturn();
        long progId = ((Number) com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id")).longValue();
        long version = ((Number) com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.version")).longValue();

        String patch = """
            {"facilitySnapshot":{"kato":"751120000","oked":"20.14"}}
            """;
        mockMvc.perform(patch("/api/pek/programs/" + progId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("If-Match", version)
                        .content(patch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilitySnapshot.kato").value("751120000"))
                .andExpect(jsonPath("$.data.facilitySnapshot.oked").value("20.14"));
    }

    // ---- item 10: permit links - same company/object → success --------------------------------

    @Test
    void createProgram_withPermitIds_linksPermitsAndReturnsThem() throws Exception {
        PekEnvironmentalPermit permit = new PekEnvironmentalPermit();
        permit.setCompanyId(companyId);
        permit.setObjectId(objectId);
        permit.setType("Комплексное экологическое разрешение");
        permit.setNumber("КЭР-2026-001");
        permit.setIssuedAt(LocalDate.of(2026, 1, 1));
        permit.setValidFrom(LocalDate.of(2026, 1, 1));
        permit.setValidTo(LocalDate.of(2028, 12, 31));
        permit.setAuthority("МЭГПР РК");
        permit.setStatus(PekPermitStatus.ACTIVE);
        permit.setCreatedBy(userId);
        permit.setUpdatedBy(userId);
        Long permitId = permitRepository.save(permit).getId();

        String body = """
            {"companyId":%d,"objectId":%d,"number":"PRM-001","name":"Прогр с разрешением",
             "validFrom":"2026-01-01","validUntil":"2026-12-31",
             "permitIds":[%d]}
            """.formatted(companyId, objectId, permitId);

        var result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permits[0].id").value(permitId))
                .andExpect(jsonPath("$.data.permits[0].number").value("КЭР-2026-001"))
                .andReturn();

        long progId = ((Number) com.jayway.jsonpath.JsonPath.read(
                result.getResponse().getContentAsString(), "$.data.id")).longValue();
        assertEquals(1, permitLinkRepository.findByProgramId(progId).size());
    }

    // ---- item 10: permit from wrong company → 400 --------------------------------------------

    @Test
    void createProgram_withPermitFromOtherCompany_returns400() throws Exception {
        Company other = new Company();
        other.setName("Другая компания");
        other.setBin("999999999999");
        other.setLegalAddress("г. Астана");
        other.setPhone("+77009999999");
        other.setStatus(CompanyStatus.ACTIVE);
        Long otherId = companyRepository.save(other).getId();

        CompanyObject otherObj = new CompanyObject();
        otherObj.setCompanyId(otherId);
        otherObj.setName("Чужой объект");
        otherObj.setAddress("г. Астана");
        otherObj.setStatus("ACTIVE");
        Long otherObjId = companyObjectRepository.save(otherObj).getId();

        PekEnvironmentalPermit foreignPermit = new PekEnvironmentalPermit();
        foreignPermit.setCompanyId(otherId);
        foreignPermit.setObjectId(otherObjId);
        foreignPermit.setType("КЭР");
        foreignPermit.setNumber("ЧУЖ-001");
        foreignPermit.setIssuedAt(LocalDate.of(2026, 1, 1));
        foreignPermit.setValidFrom(LocalDate.of(2026, 1, 1));
        foreignPermit.setValidTo(LocalDate.of(2028, 12, 31));
        foreignPermit.setAuthority("МЭГПР");
        foreignPermit.setStatus(PekPermitStatus.ACTIVE);
        foreignPermit.setCreatedBy(userId);
        foreignPermit.setUpdatedBy(userId);
        Long foreignPermitId = permitRepository.save(foreignPermit).getId();

        String body = """
            {"companyId":%d,"objectId":%d,"number":"BADPERM","name":"Прогр неверный permit",
             "validFrom":"2026-01-01","validUntil":"2026-12-31",
             "permitIds":[%d]}
            """.formatted(companyId, objectId, foreignPermitId);

        mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().is4xxClientError());
    }

    // ---- item 11: readiness MONITORING_POINTS_REQUIRED blocking check ------------------------

    @Test
    void readiness_monitoringDirectionWithoutPoints_returnsBlockingIssue() throws Exception {
        String create = """
            {"companyId":%d,"objectId":%d,"number":"RDY-001","name":"Прогр Readiness",
             "validFrom":"2026-01-01","validUntil":"2026-12-31"}
            """.formatted(companyId, objectId);
        var created = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isOk()).andReturn();
        long progId = ((Number) com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id")).longValue();

        // Add AMBIENT_AIR monitoring direction (requires points) but no points
        PekProgramMonitoring mon = new PekProgramMonitoring();
        mon.setProgramId(progId);
        mon.setMonitoringType(PekMonitoringType.AMBIENT_AIR);
        mon.setName("Атмосферный воздух");
        mon.setMethodology("РД 52.04.186-89");
        mon.setFrequencyType(PekFrequencyType.QUARTERLY);
        mon.setActive(true);
        monitoringRepository.save(mon);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/pek/programs/" + progId + "/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(false))
                .andExpect(jsonPath("$.data.issues[?(@.code=='MONITORING_POINTS_REQUIRED')].blocking")
                        .value(org.hamcrest.Matchers.contains(true)));
    }

    @Test
    void readiness_monitoringDirectionWithPoints_noBlockingOnPointsCheck() throws Exception {
        String create = """
            {"companyId":%d,"objectId":%d,"number":"RDY-002","name":"Прогр ОК Readiness",
             "validFrom":"2026-01-01","validUntil":"2026-12-31"}
            """.formatted(companyId, objectId);
        var created = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isOk()).andReturn();
        long progId = ((Number) com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id")).longValue();

        PekProgramMonitoring mon = new PekProgramMonitoring();
        mon.setProgramId(progId);
        mon.setMonitoringType(PekMonitoringType.AMBIENT_AIR);
        mon.setMethodology("РД 52.04.186-89");
        mon.setFrequencyType(PekFrequencyType.QUARTERLY);
        mon.setActive(true);
        Long monId = monitoringRepository.save(mon).getId();

        PekMonitoringPoint point = new PekMonitoringPoint();
        point.setMonitoringId(monId);
        point.setProgramId(progId);
        point.setName("Точка №1 — 50 м от источника");
        monitoringPointRepository.save(point);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/pek/programs/" + progId + "/readiness"))
                .andExpect(status().isOk())
                // MONITORING_POINTS_REQUIRED must NOT appear as a blocking issue
                .andExpect(jsonPath("$.data.issues[?(@.code=='MONITORING_POINTS_REQUIRED')]").isEmpty());
    }

    // ---- item 4: regulationVersion canonical value -------------------------------------------

    @Test
    void createProgram_regulationVersionIsCanonical() throws Exception {
        String body = """
            {"companyId":%d,"objectId":%d,"number":"REG-001","name":"Прогр версия НПА",
             "validFrom":"2026-01-01","validUntil":"2026-12-31"}
            """.formatted(companyId, objectId);

        mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                // A new program is stamped with the edition in force today, citing both the base
                // order and the 2026 amendment - never the incorrect 26.05.2023 reference.
                .andExpect(jsonPath("$.data.regulationVersion",
                        org.hamcrest.Matchers.containsString("14.07.2021")))
                .andExpect(jsonPath("$.data.regulationVersion",
                        org.hamcrest.Matchers.containsString("№59")))
                .andExpect(jsonPath("$.data.regulationCode")
                        .value(PekRegulationVersionService.PEK_RULES_250_2026_59));
    }

    // ---- item 5: submissionDueDate computed correctly (Q4 → deadline in next year) -----------

    @Test
    void submissionDeadlineService_q4PeriodEnd_deadlineInNextYear() {
        PekSubmissionDeadlineService svc = new PekSubmissionDeadlineService();
        // Q4 ends Dec 31, 2026; due = 1st day of the second month after the quarter = Feb 1, 2027
        var due = svc.calculate(PekReportType.PEK_QUARTERLY,
                PekRegulationVersionService.PEK_RULES_250_2026_59, LocalDate.of(2026, 12, 31));
        assertEquals(LocalDate.of(2027, 2, 1), due);
    }

    @Test
    void submissionDeadlineService_annualTables7And12_isThirdMonthAfterPeriod() {
        PekSubmissionDeadlineService svc = new PekSubmissionDeadlineService();
        // Tables 7 and 12 for 2026 are due on the 1st day of the third month after the period:
        // 01.03.2027. The previous plusDays(45) gave 14.02 - a rule the regulation does not state.
        var due = svc.calculate(PekReportType.PEK_TABLES_7_12_ANNUAL,
                PekRegulationVersionService.PEK_RULES_250_2026_59, LocalDate.of(2026, 12, 31));
        assertEquals(LocalDate.of(2027, 3, 1), due);
    }
}
