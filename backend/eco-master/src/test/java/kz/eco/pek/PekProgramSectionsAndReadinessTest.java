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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Module fix item 4: the five new Правила №250 program sections (monitoring points, internal
 *  inspections, measurement QA, emergency procedures, responsibility structure), regulationVersion/
 *  templateVersion/contentRevision, and readiness reflecting a legacy/incomplete program without
 *  its real workflow status ever being force-changed. */
@SpringBootTest
@Transactional
class PekProgramSectionsAndReadinessTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramReadinessFixture readinessFixture;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private User head;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО PEK Sections Test " + System.nanoTime());
        company.setBin(String.valueOf(800000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setLegalAddress("г. Алматы, ул. Тестовая, 5");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Площадка №1");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        head = new User();
        head.setEmail("pek-sections-" + System.nanoTime() + "@ecoprogress.kz");
        head.setPasswordHash(passwordEncoder.encode("demo123"));
        head.setName("Head Tester");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);

        PekStaffAssignment assignment = new PekStaffAssignment();
        assignment.setCompanyId(companyId);
        assignment.setUserId(head.getId());
        assignment.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        assignment.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(assignment);

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                head, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private Long createProgram() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-SEC-1", "name": "Программа для секций",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d,
                 "controlItems": [
                   {"code": "CI-1", "name": "Источник №1", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId, head.getId());
        MvcResult result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    // ---- new program-level metadata ------------------------------------------------------------

    @Test
    void newProgram_hasRegulationAndTemplateVersion_andZeroContentRevision() throws Exception {
        Long programId = createProgram();
        mockMvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regulationVersion").value(org.hamcrest.Matchers.containsString("250")))
                .andExpect(jsonPath("$.data.templateVersion").exists())
                .andExpect(jsonPath("$.data.contentRevision").value(0));
    }

    // ---- content-revision bump on every child-section mutation --------------------------------

    @Test
    void addingResponsibility_bumpsProgramContentRevisionAndVersion() throws Exception {
        Long programId = createProgram();
        assertEquals(0L, programRepository.findById(programId).orElseThrow().getContentRevision());

        mockMvc.perform(post("/api/pek/programs/" + programId + "/responsibilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleLabel\":\"Инженер-эколог участка\",\"duties\":\"Ведение журналов ПЭК\"}"))
                .andExpect(status().isOk());

        PekProgram reloaded = programRepository.findById(programId).orElseThrow();
        assertEquals(1L, reloaded.getContentRevision());
    }

    @Test
    void addingInternalInspection_bumpsContentRevision() throws Exception {
        Long programId = createProgram();
        mockMvc.perform(post("/api/pek/programs/" + programId + "/internal-inspections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plannedDate\":\"2026-03-01\",\"inspectionType\":\"Плановая\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PLANNED"));
        assertEquals(1L, programRepository.findById(programId).orElseThrow().getContentRevision());
    }

    @Test
    void addingMeasurementQa_bumpsContentRevision() throws Exception {
        Long programId = createProgram();
        mockMvc.perform(post("/api/pek/programs/" + programId + "/measurement-qa")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parameter\":\"PM2.5\",\"qaProcedure\":\"Поверка анализатора\",\"frequency\":\"Ежегодно\"}"))
                .andExpect(status().isOk());
        assertEquals(1L, programRepository.findById(programId).orElseThrow().getContentRevision());
    }

    @Test
    void addingEmergencyProcedure_bumpsContentRevision() throws Exception {
        Long programId = createProgram();
        mockMvc.perform(post("/api/pek/programs/" + programId + "/emergency-procedures")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenario\":\"Разлив ГСМ\",\"actions\":\"Локализовать, вызвать МЧС\",\"contactPhone\":\"112\"}"))
                .andExpect(status().isOk());
        assertEquals(1L, programRepository.findById(programId).orElseThrow().getContentRevision());
    }

    @Test
    void addingMonitoringPoint_bumpsContentRevision() throws Exception {
        Long programId = createProgram();
        // Task 4: POST /monitoring now requires If-Match: program.version (aggregate locking)
        MvcResult programResult = mockMvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(status().isOk()).andReturn();
        Long pv = Long.valueOf(JsonPath.read(programResult.getResponse().getContentAsString(), "$.data.version").toString());

        mockMvc.perform(post("/api/pek/programs/" + programId + "/monitoring")
                        .header("If-Match", pv)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"monitoringType\":\"EMISSION_SOURCE\",\"methodology\":\"Инструментальный\",\"frequencyType\":\"QUARTERLY\"}"))
                .andExpect(status().isOk());
        Long monitoringId = monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(programId).get(0).getId();
        long revisionAfterMonitoring = programRepository.findById(programId).orElseThrow().getContentRevision();
        assertTrue(revisionAfterMonitoring > 0);

        mockMvc.perform(post("/api/pek/programs/" + programId + "/monitoring/" + monitoringId + "/points")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Точка №1\",\"coordinates\":\"43.2,76.9\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Точка №1"));

        long revisionAfterPoint = programRepository.findById(programId).orElseThrow().getContentRevision();
        assertTrue(revisionAfterPoint > revisionAfterMonitoring, "adding a monitoring point must bump contentRevision further");
    }

    // ---- If-Match on the new sections (module fix item 3) --------------------------------------

    @Test
    void updateResponsibility_withoutIfMatch_returns400() throws Exception {
        Long programId = createProgram();
        MvcResult created = mockMvc.perform(post("/api/pek/programs/" + programId + "/responsibilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleLabel\":\"Лаборант\"}"))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        // If-Match is a required HTTP header here (@RequestHeader), so an entirely absent header
        // is rejected by Spring itself before reaching the service - GlobalExceptionHandler maps
        // that to the same stable VERSION_REQUIRED code the hand-checked PEK paths return.
        mockMvc.perform(put("/api/pek/programs/" + programId + "/responsibilities/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleLabel\":\"Лаборант-2\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    @Test
    void updateResponsibility_withStaleIfMatch_returns409() throws Exception {
        Long programId = createProgram();
        MvcResult created = mockMvc.perform(post("/api/pek/programs/" + programId + "/responsibilities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleLabel\":\"Лаборант\"}"))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(put("/api/pek/programs/" + programId + "/responsibilities/" + id)
                        .header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleLabel\":\"Лаборант-2\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    // ---- readiness reflects incompleteness without mutating real status -----------------------

    @Test
    void freshlyCreatedProgram_missingMandatorySections_areBlocking() throws Exception {
        Long programId = createProgram();
        mockMvc.perform(get("/api/pek/programs/" + programId + "/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(false))
                // A program cannot be approved without these sections, so they are blocking issues,
                // not warnings - they used to be warnings, which let an empty program reach ACTIVE.
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='NO_INTERNAL_INSPECTIONS')]").exists())
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='NO_MEASUREMENT_QA')]").exists())
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='NO_EMERGENCY_PROCEDURES')]").exists())
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='NO_RESPONSIBILITY_STRUCTURE')]").exists())
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='NO_INDICATORS')]").exists())
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='NO_MONITORING_DIRECTIONS')]").exists())
                // A new program is stamped with the current edition's template, so the legacy-template
                // warning - which exists to flag programs migrated from before the reference book -
                // must not fire for it.
                .andExpect(jsonPath("$.data.warnings[?(@.code=='LEGACY_TEMPLATE')]").doesNotExist());

        mockMvc.perform(get("/api/pek/programs/" + programId))
                .andExpect(jsonPath("$.data.templateVersion").value("v2-2026"));

        // Readiness stays a computed view: the program's real status is untouched by any of this,
        // never force-mutated to DRAFT/INCOMPLETE.
        assertEquals(PekProgramStatus.DRAFT, programRepository.findById(programId).orElseThrow().getStatus());
    }

    /** Applicability: a program that declares no wastewater direction is never asked for wastewater
     *  monitoring points, while one that does declare a point-bearing direction is. */
    @Test
    void monitoringPointsAreDemandedOnlyForDeclaredPointBearingDirections() throws Exception {
        Long programId = createProgram();
        readinessFixture.makeReady(programId);
        mockMvc.perform(get("/api/pek/programs/" + programId + "/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(true))
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='MONITORING_POINTS_REQUIRED')]").doesNotExist());

        // Declare a wastewater direction but give it no point - now the requirement applies.
        PekProgramMonitoring wastewater = new PekProgramMonitoring();
        wastewater.setProgramId(programId);
        wastewater.setMonitoringType(PekMonitoringType.WASTEWATER);
        wastewater.setName("Сточные воды");
        wastewater.setMethodology("Инструментальный");
        wastewater.setFrequencyType(PekFrequencyType.QUARTERLY);
        wastewater.setControlItemIds(java.util.Set.of(
                controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId()));
        monitoringRepository.saveAndFlush(wastewater);

        mockMvc.perform(get("/api/pek/programs/" + programId + "/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(false))
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code=='MONITORING_POINTS_REQUIRED')]").exists());
    }

    @Test
    void filledInProgram_hasNoNewSectionWarnings() throws Exception {
        Long programId = createProgram();
        mockMvc.perform(post("/api/pek/programs/" + programId + "/internal-inspections")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"plannedDate\":\"2026-03-01\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/programs/" + programId + "/measurement-qa")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"parameter\":\"PM2.5\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/programs/" + programId + "/emergency-procedures")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"scenario\":\"Разлив\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/programs/" + programId + "/responsibilities")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roleLabel\":\"Эколог\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/pek/programs/" + programId + "/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.warnings[?(@.code=='NO_INTERNAL_INSPECTIONS')]").doesNotExist())
                .andExpect(jsonPath("$.data.warnings[?(@.code=='NO_MEASUREMENT_QA')]").doesNotExist())
                .andExpect(jsonPath("$.data.warnings[?(@.code=='NO_EMERGENCY_PROCEDURES')]").doesNotExist())
                .andExpect(jsonPath("$.data.warnings[?(@.code=='NO_RESPONSIBILITY_STRUCTURE')]").doesNotExist());
    }
}
