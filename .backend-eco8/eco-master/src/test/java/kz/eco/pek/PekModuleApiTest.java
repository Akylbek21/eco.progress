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

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;
    private User ecologist;
    private User labUser;

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
                 "validFrom": "%s", "validUntil": "%s",
                 "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId, validFrom, validUntil);
        MvcResult result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    /** Walks a freshly-created (version 0) DRAFT program through the full review cycle to ACTIVE:
     *  submit-review -> approve -> activate (module spec §15 - DRAFT can no longer jump straight
     *  to ACTIVE). Returns the version after activation. */
    private Long activateFullWorkflow(Long programId) throws Exception {
        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"));
        mockMvc.perform(post("/api/pek/programs/" + programId + "/approve").header("If-Match", "1"))
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
        mockMvc.perform(post("/api/pek/programs/" + second + "/approve").header("If-Match", "1"))
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
        mockMvc.perform(patch("/api/pek/programs/" + programId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": 2, \"description\": \"Исправлено после замечаний\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").value("Исправлено после замечаний"))
                .andExpect(jsonPath("$.data.controlItems.length()").value(1));

        mockMvc.perform(post("/api/pek/programs/" + programId + "/submit-review").header("If-Match", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"));
        mockMvc.perform(post("/api/pek/programs/" + programId + "/approve").header("If-Match", "4"))
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
        mockMvc.perform(post("/api/pek/programs/" + programId + "/approve").header("If-Match", "1"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/pek/programs/" + programId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": 2, \"name\": \"Попытка изменить утверждённую программу\"}"))
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

        MvcResult collectResult = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect"))
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

        MvcResult first = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")).andReturn();
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
        MvcResult second = mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")).andReturn();
        assertEquals(1, ((Number) JsonPath.read(second.getResponse().getContentAsString(), "$.data.linkedProtocolCount")).intValue());
        assertEquals(1, sourceRepository.findByReportId(reportId).size());
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
        mockMvc.perform(post("/api/pek/reports/" + reportId + "/collect")).andExpect(status().isOk());

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/submit-review").header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        MvcResult submitted = mockMvc.perform(post("/api/pek/reports/" + reportId + "/submit-review").header("If-Match", "0"))
                .andExpect(status().isOk())
                .andReturn();
        Long submittedVersion = Long.valueOf(JsonPath.read(submitted.getResponse().getContentAsString(), "$.data.version").toString());

        mockMvc.perform(post("/api/pek/reports/" + reportId + "/approve").header("If-Match", "999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        MvcResult approved = mockMvc.perform(post("/api/pek/reports/" + reportId + "/approve")
                        .header("If-Match", String.valueOf(submittedVersion)))
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
        protocol.setStatus(ProtocolStatus.APPROVED);
        protocolRepository.save(protocol);
    }
}
