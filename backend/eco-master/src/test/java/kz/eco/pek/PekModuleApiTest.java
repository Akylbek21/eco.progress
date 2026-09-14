package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end coverage for the PEK module: real Company/CompanyObject validation (no
 * companyId-as-objectId), the full program review cycle (DRAFT -> UNDER_REVIEW -> RETURNED/
 * APPROVED -> ACTIVE -> ARCHIVED, module spec §15), control items/indicators/measures/documents
 * persistence, program activation/overlap, report period computation + duplicate protection, and
 * real Protocol linking via collect().
 */
@SpringBootTest
@Transactional
class PekModuleApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramReadinessFixture readinessFixture;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekProgramIndicatorRepository indicatorRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;
    private User ecologist;
    private User labUser;
    /** Module fix item 8 (maker-checker): approve() now rejects the program/report's own creator -
     *  every program/report in this file is created by {@code ecologist}, so a distinct HEAD user
     *  is needed to perform the approve step in activateFullWorkflow/reportWorkflow. */
    private User reviewer;

    private void membership(User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private RequestPostProcessor asRole(User user, UserRole role) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        return authentication(auth);
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО PEK Test");
        company.setBin("990022334455");
        company.setLegalAddress("г. Алматы, ул. Тестовая, 2");
        company.setPhone("+77001234567");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех №1");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory lab = new Laboratory();
        lab.setName("PEK Test Lab");
        lab.setLegalName("ТОО PEK Test Lab");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.PEK.001");
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(true);
        lab.setActive(true);
        laboratoryRepository.save(lab);
        laboratoryId = lab.getId();

        // HEAD (not ECOLOGIST): the default test actor drives the full program+report lifecycle
        // end-to-end (create -> submit-review -> approve -> activate -> collect -> submit-review
        // -> approve -> archive), which after PekSecurityExpressions (module spec §19 granular
        // PEK_* permissions) needs the supervisor-level role set (PEK_PROGRAM_ACTIVATE/
        // PEK_PROGRAM_APPROVE/PEK_REPORT_APPROVE etc only grant ADMIN/DIRECTOR/HEAD) - a plain
        // ECOLOGIST can create/collect but not activate, approve or review.
        ecologist = new User();
        ecologist.setEmail("pek-ecologist-" + System.nanoTime() + "@ecoprogress.kz");
        ecologist.setPasswordHash(passwordEncoder.encode("demo123"));
        ecologist.setName("Ecologist Tester");
        ecologist.setRole(UserRole.HEAD);
        ecologist.setType(ClientType.staff);
        userRepository.save(ecologist);

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(ecologist.getId());
        employee.setFullName(ecologist.getName());
        employee.setPosition("Исполнитель");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        executorId = employee.getId();

        labUser = new User();
        labUser.setEmail("pek-lab-" + System.nanoTime() + "@ecoprogress.kz");
        labUser.setPasswordHash(passwordEncoder.encode("demo123"));
        labUser.setName("Lab Tester");
        labUser.setRole(UserRole.LABORATORY);
        labUser.setType(ClientType.staff);
        userRepository.save(labUser);
        LaboratoryEmployee labUserEmployee = new LaboratoryEmployee();
        labUserEmployee.setLaboratoryId(laboratoryId);
        labUserEmployee.setUserId(labUser.getId());
        labUserEmployee.setFullName(labUser.getName());
        labUserEmployee.setEmail(labUser.getEmail());
        labUserEmployee.setActive(true);
        laboratoryEmployeeRepository.save(labUserEmployee);

        reviewer = new User();
        reviewer.setEmail("pek-reviewer-" + System.nanoTime() + "@ecoprogress.kz");
        reviewer.setPasswordHash(passwordEncoder.encode("demo123"));
        reviewer.setName("Reviewer Tester");
        reviewer.setRole(UserRole.HEAD);
        reviewer.setType(ClientType.staff);
        userRepository.save(reviewer);

        // Iteration 1 tenant isolation (PekAccessService#requireCompanyAccess): neither HEAD nor
        // LABORATORY is a global-access role, so both need an ACTIVE PekStaffAssignment in this
        // test's company or every endpoint call below would now 403.
        membership(ecologist);
        membership(labUser);
        membership(reviewer);

        if (templateRepository.findByCode("AMBIENT_AIR_SZZ").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("AMBIENT_AIR_SZZ");
            template.setName("Атмосферный воздух СЗЗ");
            template.setDescription("Атмосферный воздух СЗЗ");
            template.setFormCode("PDV");
            template.setActive(true);
            templateRepository.save(template);
        }

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                ecologist, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    /** Every program is created with one control item by default - submitReview() requires at
     *  least one (module spec: a program can't meaningfully go up for review with no content),
     *  and most of this file's tests only care about the program as a report-side fixture, not
     *  about control-item content itself (see PekProgramApiTest for that coverage). */
    private Long createProgram(String validFrom, String validUntil) throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-001", "name": "Программа ПЭК 2026",
                 "validFrom": "%s", "validUntil": "%s", "responsibleUserId": %d,
                 "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId, validFrom, validUntil, ecologist.getId());
        MvcResult result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        Long programId = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
        // The mandatory program sections are blocking readiness checks, so a program has to carry
        // them before it can be submitted/approved/activated. These tests use the program purely as
        // a report-side fixture, so the sections are filled by the shared fixture rather than
        // hand-rolled here.
        readinessFixture.makeReady(programId);
        return programId;
    }

    /** Walks a freshly-created (version 0) DRAFT program through the full review cycle to ACTIVE:
     *  submit-review -> approve -> activate (module spec §15 - DRAFT can no longer jump straight
     *  to ACTIVE). Returns the version after activation. */
    private Long activateFullWorkflow(Long programId) throws Exception {
        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"));
        mockMvc.perform(post("/api/pek/programs/" + programId + "/approve").header("If-Match", "1")
                        .with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
        MvcResult activated = mockMvc.perform(post("/api/pek/programs/" + programId + "/activate").header("If-Match", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();
        return Long.valueOf(JsonPath.read(activated.getResponse().getContentAsString(), "$.data.version").toString());
    }

    @Test
    void createProgram_withObjectFromAnotherCompany_isRejected() throws Exception {
        // A CompanyObject that genuinely exists, just not for this company - the deterministic
        // way to prove PekProgramService never falls back to "treat some other id as the object"
        // (there's no legacy companyId-as-objectId convention here at all, unlike ProtocolService).
        Company otherCompany = new Company();
        otherCompany.setName("ТОО Другая компания");
        otherCompany.setBin("990099998888");
        otherCompany.setLegalAddress("г. Астана");
        otherCompany.setPhone("+77009998877");
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        CompanyObject otherObject = new CompanyObject();
        otherObject.setCompanyId(otherCompany.getId());
        otherObject.setName("Чужой объект");
        otherObject.setAddress("г. Астана");
        otherObject.setStatus("ACTIVE");
        companyObjectRepository.save(otherObject);

        String json = """
                {"companyId": %d, "objectId": %d, "number": "X", "name": "X",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31"}
                """.formatted(companyId, otherObject.getId());
        mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("OBJECT_COMPANY_MISMATCH"));
    }

    @Test
    void createAndActivateProgram_succeeds() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
    }

    @Test
    void secondOverlappingActiveProgram_isRejected() throws Exception {
        Long first = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(first);

        Long second = createProgram("2026-06-01", "2027-06-01");
        mockMvc.perform(post("/api/pek/programs/" + second + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/programs/" + second + "/approve").header("If-Match", "1")
                        .with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/programs/" + second + "/activate").header("If-Match", "2"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_PERIOD_OVERLAP"));
    }

    @Test
    void programReturnedForCorrection_canBeResubmittedAndApproved() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/pek/programs/" + programId + "/return").header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("RETURN_REASON_REQUIRED"));

        mockMvc.perform(post("/api/pek/programs/" + programId + "/return").header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Не хватает норматива по показателю\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RETURNED"));

        // A RETURNED program is still editable (module spec §16) - the author can fix it and
        // resubmit without losing the control item added at creation.
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\": \"Исправлено после замечаний\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("Исправлено после замечаний"))
                .andExpect(jsonPath("$.data.controlItems.length()").value(1));

        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"));
        mockMvc.perform(post("/api/pek/programs/" + programId + "/approve").header("If-Match", "4")
                        .with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        List<PekProgramControlItem> items = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        assertEquals(1, items.size());
    }

    @Test
    void submitReview_withoutControlItems_isRejected() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-EMPTY", "name": "Пустая программа",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31"}
                """.formatted(companyId, objectId);
        MvcResult result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        Long programId = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_EMPTY"));
    }

    @Test
    void editProgram_afterApproval_isRejected() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/programs/" + programId + "/approve").header("If-Match", "1")
                        .with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Попытка изменить утверждённую программу\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_NOT_EDITABLE"));
    }

    @Test
    void cloneProgram_copiesControlItemsIntoNewDraft() throws Exception {
        Long sourceId = createProgram("2026-01-01", "2026-12-31");
        MvcResult cloneResult = mockMvc.perform(post("/api/pek/programs/" + sourceId + "/clone")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\": \"ПЭК-002\", \"name\": \"Копия программы\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.controlItems.length()").value(1))
                .andReturn();
        Long cloneId = Long.valueOf(JsonPath.read(cloneResult.getResponse().getContentAsString(), "$.data.id").toString());
        assertNotEquals(sourceId, cloneId);
        assertEquals(1, controlItemRepository.findByProgramIdOrderBySortOrderAsc(cloneId).size());
    }

    @Test
    void programHistory_recordsLifecycleEvents() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);

        MvcResult history = mockMvc.perform(get("/api/pek/programs/" + programId + "/history"))
                .andExpect(status().isOk())
                .andReturn();
        List<String> actions = JsonPath.read(history.getResponse().getContentAsString(), "$.data[*].actionType");
        assertTrue(actions.contains("CREATE"));
        assertTrue(actions.contains("SUBMIT_REVIEW"));
        assertTrue(actions.contains("APPROVE"));
        assertTrue(actions.contains("ACTIVATE"));
    }

    @Test
    void uploadAndDownloadProgramDocument_roundTrips() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        MockMultipartFile file = new MockMultipartFile(
                "file", "program-order.pdf", MediaType.APPLICATION_PDF_VALUE, "приказ".getBytes());

        MvcResult upload = mockMvc.perform(multipart("/api/pek/programs/" + programId + "/documents")
                        .file(file)
                        .param("documentType", "ORDER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileName").value("program-order.pdf"))
                .andReturn();
        Long documentId = Long.valueOf(JsonPath.read(upload.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(get("/api/pek/programs/" + programId + "/documents/" + documentId))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("program-order.pdf")));
    }

    /** Module fix: uploadDocument previously never checked isEditable() - a document could be
     *  attached to an ACTIVE (read-only) program despite every other field on the aggregate
     *  already enforcing this rule. Frontend hiding the upload button is not a substitute. */
    @Test
    void uploadDocument_toActiveProgram_isRejectedAsNotEditable() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);

        MockMultipartFile file = new MockMultipartFile(
                "file", "late-upload.pdf", MediaType.APPLICATION_PDF_VALUE, "приказ".getBytes());
        mockMvc.perform(multipart("/api/pek/programs/" + programId + "/documents")
                        .file(file)
                        .param("documentType", "ORDER"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_NOT_EDITABLE"));
    }

    @Test
    void listPrograms_withoutCompanyOrObjectId_doesNotReturn400() throws Exception {
        createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(get("/api/pek/programs"))
                .andExpect(status().isOk());
    }

    @Test
    void createReport_autoSelectsSingleActiveProgram_andComputesPeriod() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);

        String json = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        mockMvc.perform(post("/api/pek/reports")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.programId").value(String.valueOf(programId)))
                .andExpect(jsonPath("$.data.periodStart").value("2026-07-01"))
                .andExpect(jsonPath("$.data.periodEnd").value("2026-09-30"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    void duplicateReport_isRejected() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
        String json = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        mockMvc.perform(post("/api/pek/reports").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/pek/reports").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DUPLICATE"));
    }

    @Test
    void reportWithoutActiveProgram_isRejected() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        mockMvc.perform(post("/api/pek/reports").contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_ACTIVE_PROGRAM_MISSING"));
    }

    @Test
    void collect_linksRealFinalizedProtocols_andSkipsDraftsAndOutOfRange() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
        String reportJson = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        MvcResult reportResult = mockMvc.perform(post("/api/pek/reports")
                        .contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isOk())
                .andReturn();
        Long reportId = Long.valueOf(JsonPath.read(reportResult.getResponse().getContentAsString(), "$.data.id").toString());

        // In-range but still DRAFT (never approved/signed) - a real monitoring result must be
        // finalized to count (spec: "DRAFT-протокол не считается фактом").
        createProtocol("2026-08-15");
        // Out-of-range: finalized, but its date falls outside Q3 2026.
        Long outOfRange = createProtocol("2026-04-01");
        finalizeProtocol(outOfRange);

        Long v0 = reportRepository.findById(reportId).orElseThrow().getVersion();
        MvcResult collectResult = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")
                        .header("If-Match", String.valueOf(v0)))
                .andReturn();
        assertEquals(200, collectResult.getResponse().getStatus());
        assertEquals(0, ((Number) JsonPath.read(collectResult.getResponse().getContentAsString(), "$.data.linkedProtocolCount")).intValue());
    }

    @Test
    void collect_linksFinalizedInRangeProtocol_andIsIdempotent() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
        String reportJson = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        MvcResult reportResult = mockMvc.perform(post("/api/pek/reports")
                        .contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isOk())
                .andReturn();
        Long reportId = Long.valueOf(JsonPath.read(reportResult.getResponse().getContentAsString(), "$.data.id").toString());

        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);

        Long v0 = reportRepository.findById(reportId).orElseThrow().getVersion();
        MvcResult first = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")
                        .header("If-Match", String.valueOf(v0))).andReturn();
        assertEquals(1, ((Number) JsonPath.read(first.getResponse().getContentAsString(), "$.data.linkedProtocolCount")).intValue());
        assertEquals("COLLECTING", JsonPath.read(first.getResponse().getContentAsString(), "$.data.report.status"));

        // Linking now lives in pek_report_protocol_sources, not a FK column on Protocol - one
        // protocol can belong to multiple reports (quarterly + yearly + a later correction) at
        // once, which a single FK on Protocol could never support.
        List<PekReportProtocolSource> sources = sourceRepository.findByReportId(reportId);
        assertEquals(1, sources.size());
        assertEquals(protocolId, sources.get(0).getProtocolId());
        assertEquals(PekMatchStatus.MATCHED, sources.get(0).getMatchStatus());
        assertEquals(programId, sources.get(0).getProgramId());

        // Re-running collect() must not duplicate - same protocol, same count, same single row.
        Long v1 = reportRepository.findById(reportId).orElseThrow().getVersion();
        MvcResult second = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")
                        .header("If-Match", String.valueOf(v1))).andReturn();
        assertEquals(1, ((Number) JsonPath.read(second.getResponse().getContentAsString(), "$.data.linkedProtocolCount")).intValue());
        assertEquals(1, sourceRepository.findByReportId(reportId).size());
    }

    @Test
    void manualProtocolSource_isDurableAndIdempotent() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setStatus(PekProgramStatus.ACTIVE);
        programRepository.save(program);
        MvcResult reportResult = mockMvc.perform(post("/api/pek/reports")
                        .with(asRole(ecologist, UserRole.ECOLOGIST))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":" + companyId + ",\"objectId\":" + objectId
                                + ",\"periodType\":\"QUARTER\",\"year\":2026,\"quarter\":3}"))
                .andExpect(status().isOk()).andReturn();
        Long reportId = Long.valueOf(JsonPath.read(reportResult.getResponse().getContentAsString(), "$.data.id").toString());

        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        Long controlItemId = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).getFirst().getId();
        String linkJson = "{\"protocolId\":" + protocolId + ",\"programId\":" + programId
                + ",\"controlItemId\":" + controlItemId + "}";

        MvcResult first = mockMvc.perform(post("/api/pek/reports/" + reportId + "/protocol-sources")
                        .with(asRole(ecologist, UserRole.ECOLOGIST))
                        .contentType(MediaType.APPLICATION_JSON).content(linkJson))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.matchType").value("MANUAL"))
                .andReturn();
        String linkId = JsonPath.read(first.getResponse().getContentAsString(), "$.data.id").toString();

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/protocol-sources")
                        .with(asRole(ecologist, UserRole.ECOLOGIST))
                        .contentType(MediaType.APPLICATION_JSON).content(linkJson))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(Long.valueOf(linkId)));
        assertEquals(1, sourceRepository.findByReportId(reportId).size());

        mockMvc.perform(get("/api/protocols/" + protocolId + "/pek-links")
                        .with(asRole(labUser, UserRole.LABORATORY)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(Long.valueOf(linkId)));
    }

    @Test
    void listPrograms_isPaginated() throws Exception {
        for (int i = 0; i < 3; i++) {
            createProgram("2026-0" + (i + 1) + "-01", "2026-0" + (i + 1) + "-28");
        }
        mockMvc.perform(get("/api/pek/programs")
                        .param("companyId", String.valueOf(companyId))
                        .param("objectId", String.valueOf(objectId))
                        .param("page", "0").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(2))
                .andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.hasNext").value(true));
    }

    @Test
    void listPrograms_defaultsPageAndSize_whenOmitted() throws Exception {
        createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(get("/api/pek/programs")
                        .param("companyId", String.valueOf(companyId))
                        .param("objectId", String.valueOf(objectId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(20));
    }

    @Test
    void listPrograms_filtersByStatusAndSearch() throws Exception {
        Long draft = createProgram("2026-01-01", "2026-06-30");
        Long active = createProgram("2026-07-01", "2026-12-31");
        activateFullWorkflow(active);

        mockMvc.perform(get("/api/pek/programs").param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(String.valueOf(active)));

        mockMvc.perform(get("/api/pek/programs").param("status", "DRAFT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(String.valueOf(draft)));
    }

    @Test
    void listReports_isPaginated() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
        for (int q = 1; q <= 2; q++) {
            String json = """
                    {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": %d}
                    """.formatted(companyId, objectId, q);
            mockMvc.perform(post("/api/pek/reports").contentType(MediaType.APPLICATION_JSON).content(json))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/pek/reports")
                        .param("companyId", String.valueOf(companyId))
                        .param("objectId", String.valueOf(objectId))
                        .param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2));
    }

    @Test
    void activateProgram_withStaleVersion_is409() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/activate")
                        .header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    @Test
    void activateProgram_fromDraft_withoutReview_isRejected() throws Exception {
        // module spec §15: DRAFT can no longer jump straight to ACTIVE, it must go through
        // UNDER_REVIEW -> APPROVED first.
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/activate").header("If-Match", "0"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_INVALID_TRANSITION"));
    }

    @Test
    void activateProgram_withoutIfMatchHeader_is400() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/activate"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void archiveProgram_withCorrectVersion_succeeds() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        Long version = activateFullWorkflow(programId);
        mockMvc.perform(post("/api/pek/programs/" + programId + "/archive").header("If-Match", String.valueOf(version)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    @Test
    void reportWorkflow_withStaleVersion_is409OnSubmitAndApproveAndArchive() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
        String reportJson = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        MvcResult reportResult = mockMvc.perform(post("/api/pek/reports")
                        .contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isOk())
                .andReturn();
        Long reportId = Long.valueOf(JsonPath.read(reportResult.getResponse().getContentAsString(), "$.data.id").toString());

        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        Long preCollectVersion = reportRepository.findById(reportId).orElseThrow().getVersion();
        MvcResult collected = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")
                        .header("If-Match", String.valueOf(preCollectVersion)))
                .andExpect(status().isOk()).andReturn();
        Long collectedVersion = Long.valueOf(JsonPath.read(
                collected.getResponse().getContentAsString(), "$.data.report.version").toString());
        makeReportReady(reportId, programId);

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/submit-review").header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        MvcResult submitted = mockMvc.perform(post("/api/pek/reports/" + reportId + "/submit-review")
                        .header("If-Match", String.valueOf(collectedVersion)))
                .andReturn();
        assertEquals(200, submitted.getResponse().getStatus(), submitted.getResponse().getContentAsString());
        Long submittedVersion = Long.valueOf(JsonPath.read(submitted.getResponse().getContentAsString(), "$.data.version").toString());

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/approve").header("If-Match", "999")
                        .with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        MvcResult approved = mockMvc.perform(post("/api/pek/reports/" + reportId + "/approve")
                        .header("If-Match", String.valueOf(submittedVersion))
                        .with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(status().isOk())
                .andReturn();
        Long approvedVersion = Long.valueOf(JsonPath.read(approved.getResponse().getContentAsString(), "$.data.version").toString());

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/archive").header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/archive").header("If-Match", String.valueOf(approvedVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    @Test
    void activateProgram_asLaboratoryRole_isForbidden() throws Exception {
        // PEK_PROGRAM_ACTIVATE only grants ADMIN/DIRECTOR/HEAD (module spec §19/§2.3) - a
        // LABORATORY user can create reports/collect data but must not be able to activate a
        // program, replacing the old single blanket STAFF check that let any staff role do this.
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/activate")
                        .with(asRole(labUser, UserRole.LABORATORY))
                        .header("If-Match", "0"))
                .andExpect(status().isForbidden());
    }

    @Test
    void submitReviewProgram_asLaboratoryRole_isForbidden() throws Exception {
        // PEK_PROGRAM_EDIT (submit-review is an edit-adjacent action) does not include LABORATORY.
        Long programId = createProgram("2026-01-01", "2026-12-31");
        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review")
                        .with(asRole(labUser, UserRole.LABORATORY))
                        .header("If-Match", "0"))
                .andExpect(status().isForbidden());
    }

    @Test
    void approveReport_asLaboratoryRole_isForbidden() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);
        String reportJson = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(companyId, objectId);
        MvcResult reportResult = mockMvc.perform(post("/api/pek/reports")
                        .with(asRole(labUser, UserRole.LABORATORY))
                        .contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isOk())
                .andReturn();
        Long reportId = Long.valueOf(JsonPath.read(reportResult.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/approve")
                        .with(asRole(labUser, UserRole.LABORATORY))
                        .header("If-Match", "0"))
                .andExpect(status().isForbidden());
    }

    @Test
    void createReport_withCollectImmediately_collectsSynchronouslyOnCreate() throws Exception {
        Long programId = createProgram("2026-01-01", "2026-12-31");
        activateFullWorkflow(programId);

        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);

        String reportJson = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3,
                 "collectImmediately": true}
                """.formatted(companyId, objectId);
        mockMvc.perform(post("/api/pek/reports")
                        .contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.linkedProtocolCount").value(1))
                .andExpect(jsonPath("$.data.status").value("COLLECTING"));
    }

    private Long createProtocol(String protocolDate) throws Exception {
        String json = """
                {"templateId": "ambient_air_szz", "companyId": %d, "objectId": %d,
                 "protocolDate": "%s", "sampleDate": "%s", "testingStartDate": "%s", "testingEndDate": "%s",
                 "measurementPlace": "Точка №1", "laboratoryId": %d, "executorId": %d}
                """.formatted(companyId, objectId, protocolDate, protocolDate, protocolDate, protocolDate,
                laboratoryId, executorId);
        MvcResult result = mockMvc.perform(post("/api/protocols")
                        .with(asRole(labUser, UserRole.LABORATORY))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    /** Flips the protocol straight to APPROVED via the repository, bypassing the full
     *  ready-for-approval/approve workflow (which needs DOCX/PDF generation) - this test only
     *  needs a protocol in a genuinely "finalized" status for PekReportCollectionService's filter,
     *  not full document-generation coverage (already covered by ProtocolServiceTest). */
    private void finalizeProtocol(Long protocolId) {
        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocolRepository.save(protocol);
    }

    private Long createReport(int quarter) throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2027, "quarter": %d}
                """.formatted(companyId, objectId, quarter);
        MvcResult result = mockMvc.perform(post("/api/pek/reports")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    private void makeReportReady(Long reportId, Long programId) {
        // Programs now carry a controlled indicator (a blocking program-readiness requirement), so
        // a collected report has real plan/fact rows of its own. Report readiness sums missingCount
        // across ALL rows, so those have to be completed too - dropping in one synthetic completed
        // row is no longer enough on its own.
        for (PekReportPlanFactRow existing : planFactRowRepository.findByReportIdOrderByControlItemIdAsc(reportId)) {
            existing.setActualCount(existing.getPlannedCount());
            existing.setMissingCount(0);
            existing.setCompletionPercent(java.math.BigDecimal.valueOf(100));
            existing.setStatus(PekPlanFactRowStatus.COMPLETED);
            planFactRowRepository.saveAndFlush(existing);
        }
        PekReportPlanFactRow row = new PekReportPlanFactRow();
        row.setReportId(reportId);
        row.setControlItemId(controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId());
        row.setProgramIndicatorId(9_000_000L + reportId);
        row.setPlannedCount(1);
        row.setActualCount(1);
        row.setMissingCount(0);
        row.setCompletionPercent(java.math.BigDecimal.valueOf(100));
        row.setStatus(PekPlanFactRowStatus.COMPLETED);
        planFactRowRepository.saveAndFlush(row);
    }

    /** Covers the backend contract behind eco.progress's src/features/pek/api/pekService.ts: every
     *  report data-sources/plan-fact/readiness/return/settings endpoint it calls must be wired
     *  (never 404/405), ReportResponse.availableActions must be server-computed (never client-
     *  supplied) and reflect status + role + readiness together, a return without a reason must be
     *  rejected, an invalid status transition must 409 with INVALID_REPORT_STATUS_TRANSITION, and a
     *  GET after a workflow action must reflect the new status. */
    @Test
    void reportContractEndpoints_respondSuccessfully_andAvailableActionsReflectStatusAndReadiness() throws Exception {
        Long programId = createProgram("2027-01-01", "2027-12-31");
        activateFullWorkflow(programId);
        Long reportId = createReport(1);

        // Not yet collected/plan-fact-complete: collect is offered, submitReview is not (readiness).
        mockMvc.perform(get("/api/pek/reports/" + reportId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.collect").value(true))
                .andExpect(jsonPath("$.data.availableActions.submitReview").value(false))
                .andExpect(jsonPath("$.data.availableActions.approve").value(false))
                .andExpect(jsonPath("$.data.availableActions.archive").value(false));

        // A client-supplied availableActions must never be honoured - the server always recomputes it.
        mockMvc.perform(get("/api/pek/reports/" + reportId))
                .andExpect(jsonPath("$.data.availableActions").isMap());

        Long protocolId = createProtocol("2027-01-15");
        finalizeProtocol(protocolId);
        Long preCollectVersion = reportRepository.findById(reportId).orElseThrow().getVersion();
        MvcResult collected = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")
                        .header("If-Match", String.valueOf(preCollectVersion)))
                .andExpect(status().isOk()).andReturn();
        Long collectedVersion = Long.valueOf(
                JsonPath.read(collected.getResponse().getContentAsString(), "$.data.report.version").toString());

        // Sources/plan-fact/readiness/settings endpoints from pekService.ts must all be reachable.
        mockMvc.perform(get("/api/pek/reports/" + reportId + "/sources")).andExpect(status().isOk());
        mockMvc.perform(get("/api/pek/reports/" + reportId + "/sources/summary")).andExpect(status().isOk());
        mockMvc.perform(get("/api/pek/reports/" + reportId + "/plan-fact")).andExpect(status().isOk());
        MvcResult readiness = mockMvc.perform(get("/api/pek/reports/" + reportId + "/readiness"))
                .andExpect(status().isOk()).andReturn();
        assertEquals(false, JsonPath.read(readiness.getResponse().getContentAsString(), "$.data.ready"));
        mockMvc.perform(get("/api/pek/settings")).andExpect(status().isOk());

        // Still not ready (no plan-fact rows yet) -> attempting submit-review 409s before even
        // reaching the transition check, and availableActions.submitReview stays false.
        mockMvc.perform(get("/api/pek/reports/" + reportId))
                .andExpect(jsonPath("$.data.availableActions.submitReview").value(false));
        mockMvc.perform(post("/api/pek/reports/" + reportId + "/submit-review")
                        .header("If-Match", String.valueOf(collectedVersion)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_NOT_READY"));

        makeReportReady(reportId, programId);
        mockMvc.perform(get("/api/pek/reports/" + reportId))
                .andExpect(jsonPath("$.data.availableActions.submitReview").value(true));

        MvcResult submitted = mockMvc.perform(post("/api/pek/reports/" + reportId + "/submit-review")
                        .header("If-Match", String.valueOf(collectedVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY_FOR_REVIEW"))
                .andReturn();
        Long submittedVersion = Long.valueOf(
                JsonPath.read(submitted.getResponse().getContentAsString(), "$.data.version").toString());
        // GET after the workflow action reflects the new status, not the pre-transition one.
        // Maker-checker (module fix item 8): the report's own creator (ecologist, the ambient
        // actor) must never see approve=true for their own submission - only a distinct reviewer
        // does.
        mockMvc.perform(get("/api/pek/reports/" + reportId))
                .andExpect(jsonPath("$.data.status").value("READY_FOR_REVIEW"))
                .andExpect(jsonPath("$.data.availableActions.approve").value(false))
                .andExpect(jsonPath("$.data.availableActions.returnForRevision").value(true))
                .andExpect(jsonPath("$.data.availableActions.submitReview").value(false));
        mockMvc.perform(get("/api/pek/reports/" + reportId).with(asRole(reviewer, UserRole.HEAD)))
                .andExpect(jsonPath("$.data.availableActions.approve").value(true));

        // Return without a reason is rejected.
        mockMvc.perform(post("/api/pek/reports/" + reportId + "/return")
                        .header("If-Match", String.valueOf(submittedVersion))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_RETURN_REASON_REQUIRED"));

        MvcResult returned = mockMvc.perform(post("/api/pek/reports/" + reportId + "/return")
                        .header("If-Match", String.valueOf(submittedVersion))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Не хватает данных\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RETURNED"))
                .andExpect(jsonPath("$.data.returnInfo.reason").value("Не хватает данных"))
                .andReturn();
        Long returnedVersion = Long.valueOf(
                JsonPath.read(returned.getResponse().getContentAsString(), "$.data.version").toString());

        // An invalid transition (approve a RETURNED report, which must go through submit-review
        // again first) 409s with the exact contract code, not a generic conflict.
        mockMvc.perform(post("/api/pek/reports/" + reportId + "/approve")
                        .header("If-Match", String.valueOf(returnedVersion)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_REPORT_STATUS_TRANSITION"));
    }

    /** Report-scoped counterpart to PekCompanyIsolationTest (which only covered programs and the
     *  reports LIST endpoint's company-filter): every report-detail endpoint pekService.ts calls
     *  must 403 a caller with no membership in the report's company, even with a guessed valid id. */
    @Test
    void reportDetailEndpoints_rejectCallerOutsideReportsCompany() throws Exception {
        Long programId = createProgram("2027-01-01", "2027-12-31");
        activateFullWorkflow(programId);
        Long reportId = createReport(2);

        Company otherCompany = new Company();
        otherCompany.setName("PEK Other Company " + System.nanoTime());
        otherCompany.setBin(String.valueOf(400000000000L + Math.abs(System.nanoTime() % 500000000000L)));
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        User outsider = new User();
        outsider.setEmail("pek-outsider-" + System.nanoTime() + "@ecoprogress.kz");
        outsider.setPasswordHash(passwordEncoder.encode("demo123"));
        outsider.setName("Outsider");
        outsider.setRole(UserRole.HEAD);
        outsider.setType(ClientType.staff);
        userRepository.save(outsider);
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(otherCompany.getId());
        m.setUserId(outsider.getId());
        m.setTier(PekStaffTier.defaultForRole(outsider.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);

        RequestPostProcessor asOutsider = asRole(outsider, UserRole.HEAD);
        mockMvc.perform(get("/api/pek/reports/" + reportId).with(asOutsider))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/pek/reports/" + reportId + "/sources").with(asOutsider))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/pek/reports/" + reportId + "/readiness").with(asOutsider))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect").with(asOutsider)
                        .header("If-Match", "0"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/pek/reports/" + reportId + "/return").with(asOutsider)
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"x\"}"))
                .andExpect(status().isForbidden());
    }
}
