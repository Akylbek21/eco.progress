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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The inventory endpoints are wired, tenant-scoped, and follow the module's If-Match convention -
 * the things a service-level test cannot tell you.
 */
@SpringBootTest
@Transactional
class PekInventoryApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;

    private MockMvc mvc;
    private Long programId;
    private User head;
    private User outsider;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = company("ТОО Инвентарь ");
        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Объект инвентаря");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        head = user("pek-inv-head-", UserRole.HEAD);
        membership(company.getId(), head);
        // Same global role, but no membership in THIS company.
        outsider = user("pek-inv-outsider-", UserRole.HEAD);
        membership(company("ТОО Чужая ").getId(), outsider);

        PekProgram program = new PekProgram();
        program.setCompanyId(company.getId());
        program.setObjectId(object.getId());
        program.setNumber("ПЭК-ИНВ-1");
        program.setName("Программа инвентаря");
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setResponsibleUserId(head.getId());
        program.setCreatedBy(head.getId());
        programRepository.saveAndFlush(program);
        programId = program.getId();
    }

    private Company company(String prefix) {
        Company c = new Company();
        c.setName(prefix + System.nanoTime());
        c.setBin(String.valueOf(500000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        c.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.save(c);
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

    private static final String EMISSION_BODY = """
            {"code": "0001", "name": "Труба котельной", "sourceType": "ORGANIZED",
             "heightM": "35.5", "diameterM": "1.2", "cleaningEfficiencyPercent": "92.5"}
            """;

    @Test
    void emissionSourceCrud_roundTripsThroughTheApi() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/emission-sources").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(EMISSION_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code").value("0001"))
                .andExpect(jsonPath("$.data.heightM").value("35.5"))
                .andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
        Long version = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.version").toString());

        mvc.perform(get("/api/pek/programs/" + programId + "/emission-sources").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(put("/api/pek/programs/" + programId + "/emission-sources/" + id).with(as(head))
                        .header("If-Match", version)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"0001\",\"name\":\"Труба котельной (уточнено)\",\"heightM\":\"36\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.heightM").value("36"));

        mvc.perform(delete("/api/pek/programs/" + programId + "/emission-sources/" + id).with(as(head))
                        .header("If-Match", version + 1))
                .andExpect(status().isOk());
        mvc.perform(get("/api/pek/programs/" + programId + "/emission-sources").with(as(head)))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void mutationWithoutIfMatch_isRejected() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/emission-sources").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(EMISSION_BODY))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(put("/api/pek/programs/" + programId + "/emission-sources/" + id).with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(EMISSION_BODY))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mutationWithStaleIfMatch_returns409() throws Exception {
        MvcResult created = mvc.perform(post("/api/pek/programs/" + programId + "/emission-sources").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(EMISSION_BODY))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(put("/api/pek/programs/" + programId + "/emission-sources/" + id).with(as(head))
                        .header("If-Match", "999")
                        .contentType(MediaType.APPLICATION_JSON).content(EMISSION_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    @Test
    void callerFromAnotherCompany_cannotReadOrWriteTheseInventories() throws Exception {
        mvc.perform(get("/api/pek/programs/" + programId + "/waste-items").with(as(outsider)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/pek/programs/" + programId + "/emission-sources").with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content(EMISSION_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void dischargeAndWasteEndpointsAreWired() throws Exception {
        mvc.perform(post("/api/pek/programs/" + programId + "/discharge-sources").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"В-1\",\"name\":\"Ливневый выпуск\",\"receivingWaterBody\":\"р. Есиль\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.receivingWaterBody").value("р. Есиль"));

        mvc.perform(post("/api/pek/programs/" + programId + "/waste-items").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Отработанные масла\",\"code\":\"555\",\"hazardClass\":\"III\","
                                + "\"accumulationLimit\":\"5\",\"limitUnit\":\"т\",\"accumulationPeriodDays\":180}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accumulationLimit").value("5"))
                .andExpect(jsonPath("$.data.accumulationPeriodDays").value(180));
    }
}
