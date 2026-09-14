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

/** Module fix: /api/pek/programs/{id}/monitoring CRUD contract - the unified DTO shape (including
 *  availableActions) and mandatory If-Match optimistic locking on PUT (previously body-only) and
 *  DELETE. */
@SpringBootTest
@Transactional
class PekMonitoringApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramReadinessFixture readinessFixture;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long programId;
    private User head;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Monitoring Test " + System.nanoTime());
        company.setBin(String.valueOf(500000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Monitoring Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        head = user("pek-mon-head-", UserRole.HEAD);
        membership(companyId, head);

        String programJson = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-MON-001", "name": "Программа мониторинга",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d,
                 "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId, head.getId());
        MvcResult created = mvc.perform(post("/api/pek/programs").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(programJson))
                .andExpect(status().isOk())
                .andReturn();
        programId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
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

    private String createBody() {
        return """
                {"monitoringType": "EMISSION_SOURCE", "name": "Выбросы", "methodology": "МУК 4.1",
                 "frequencyType": "QUARTERLY", "plannedCount": 4, "controlItemIds": [], "active": true}
                """;
    }

    /** Fetches program.version from the API (GET program detail). If-Match for monitoring mutations
     *  is the PROGRAM's JPA @Version, not the monitoring row's version (task 4: monitoring is part
     *  of the program aggregate). */
    private Long programVersion() throws Exception {
        MvcResult r = mvc.perform(get("/api/pek/programs/" + programId).with(as(head)))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(r.getResponse().getContentAsString(), "$.data.version").toString());
    }

    private long contentRevision() throws Exception {
        MvcResult r = mvc.perform(get("/api/pek/programs/" + programId).with(as(head)))
                .andExpect(status().isOk()).andReturn();
        return Long.parseLong(JsonPath.read(r.getResponse().getContentAsString(), "$.data.contentRevision").toString());
    }

    /** Module fix: create/update/delete now return the full program aggregate (ApiResponse&lt;ProgramResponse&gt;)
     *  with the up-to-date monitoring list embedded, so the frontend gets program.version,
     *  contentRevision, readiness and availableActions from the mutation response itself - no
     *  second GET .../monitoring round-trip, and DELETE never answers with a bare data: null. */
    @Test
    void createReadUpdateDelete_roundTripsWithAllFields() throws Exception {
        Long pv0 = programVersion();
        long cr0 = contentRevision();

        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/monitoring").with(as(head))
                        .header("If-Match", pv0)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(programId))
                .andExpect(jsonPath("$.data.version").exists())
                .andExpect(jsonPath("$.data.contentRevision").value((int) cr0 + 1))
                .andExpect(jsonPath("$.data.availableActions").exists())
                .andExpect(jsonPath("$.data.monitoring.programId").value(programId))
                .andExpect(jsonPath("$.data.monitoring.items[0].programId").value(programId))
                .andExpect(jsonPath("$.data.monitoring.items[0].monitoringType").value("EMISSION_SOURCE"))
                .andExpect(jsonPath("$.data.monitoring.items[0].name").value("Выбросы"))
                .andExpect(jsonPath("$.data.monitoring.items[0].methodology").value("МУК 4.1"))
                .andExpect(jsonPath("$.data.monitoring.items[0].frequencyType").value("QUARTERLY"))
                .andExpect(jsonPath("$.data.monitoring.items[0].plannedCount").value(4))
                .andExpect(jsonPath("$.data.monitoring.items[0].controlItemIds").isArray())
                .andExpect(jsonPath("$.data.monitoring.items[0].protocolTypes").isArray())
                .andExpect(jsonPath("$.data.monitoring.items[0].active").value(true))
                .andExpect(jsonPath("$.data.monitoring.items[0].availableActions.edit").value(true))
                .andExpect(jsonPath("$.data.monitoring.items[0].availableActions.delete").value(true))
                .andExpect(jsonPath("$.data.monitoring.availableActions.create").value(true))
                .andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.monitoring.items[0].id").toString());

        mvc.perform(get("/api/pek/programs/" + programId + "/monitoring").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.programId").value(programId))
                .andExpect(jsonPath("$.data.items[0].id").value(id))
                .andExpect(jsonPath("$.data.availableActions.create").value(true));

        Long pv1 = programVersion();
        mvc.perform(put("/api/pek/programs/" + programId + "/monitoring/" + id).with(as(head))
                        .header("If-Match", pv1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"monitoringType": "EMISSION_SOURCE", "name": "Выбросы (обновлено)",
                                 "methodology": "МУК 4.2", "frequencyType": "MONTHLY", "plannedCount": 12,
                                 "controlItemIds": [], "active": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.monitoring.items[0].name").value("Выбросы (обновлено)"));

        Long pv2 = programVersion();
        mvc.perform(delete("/api/pek/programs/" + programId + "/monitoring/" + id).with(as(head))
                        .header("If-Match", pv2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(programId))
                .andExpect(jsonPath("$.data.version").exists())
                .andExpect(jsonPath("$.data.monitoring.items.length()").value(0));

        mvc.perform(get("/api/pek/programs/" + programId + "/monitoring").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(0));
    }

    @Test
    void create_withoutIfMatch_isRejectedAsVersionRequired() throws Exception {
        // POST /monitoring now also requires If-Match: program.version
        mvc.perform(post("/api/pek/programs/" + programId + "/monitoring").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_withoutIfMatch_isRejectedAsVersionRequired() throws Exception {
        Long pv = programVersion();
        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/monitoring").with(as(head))
                        .header("If-Match", pv)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.monitoring.items[0].id").toString());

        mvc.perform(put("/api/pek/programs/" + programId + "/monitoring/" + id).with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_withStaleIfMatch_returns409() throws Exception {
        Long pv = programVersion();
        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/monitoring").with(as(head))
                        .header("If-Match", pv)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.monitoring.items[0].id").toString());

        mvc.perform(put("/api/pek/programs/" + programId + "/monitoring/" + id).with(as(head))
                        .header("If-Match", "99999")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    @Test
    void delete_withStaleIfMatch_returns409() throws Exception {
        Long pv = programVersion();
        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/monitoring").with(as(head))
                        .header("If-Match", pv)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.monitoring.items[0].id").toString());

        mvc.perform(delete("/api/pek/programs/" + programId + "/monitoring/" + id).with(as(head))
                        .header("If-Match", "99999"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    /** Monitoring rows can only be added/changed while the PROGRAM itself is editable
     *  (DRAFT/RETURNED). After submit-review, it's under review and mutations must be rejected. */
    @Test
    void create_onNonEditableProgram_isRejected() throws Exception {
        // Submit-review requires the mandatory program sections (blocking readiness checks). The
        // fixture direction uses WASTE so it does not collide with the EMISSION_SOURCE row
        // this test posts - a monitoring type may be declared only once per program.
        readinessFixture.makeReady(programId, PekMonitoringType.WASTE);
        Long pv = programVersion();
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(head))
                        .header("If-Match", pv))
                .andExpect(status().isOk());

        Long pvAfter = programVersion();
        mvc.perform(post("/api/pek/programs/" + programId + "/monitoring").with(as(head))
                        .header("If-Match", pvAfter)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_NOT_EDITABLE"));
    }
}
