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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Synthetic (no real client data) tenant fixtures for PEK scenario tests: company + object, staff
 * users with company memberships, and a program walked through DRAFT -> UNDER_REVIEW -> APPROVED ->
 * ACTIVE by DIFFERENT maker/checker users via the real API.
 */
@Component
public class PekScenarioSupport {

    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository companyObjectRepository;
    private final UserRepository userRepository;
    private final PekStaffAssignmentRepository membershipRepository;
    private final PekProgramReadinessFixture readinessFixture;

    public PekScenarioSupport(CompanyRepository companyRepository, CompanyObjectRepository companyObjectRepository,
                              UserRepository userRepository, PekStaffAssignmentRepository membershipRepository,
                              PekProgramReadinessFixture readinessFixture) {
        this.companyRepository = companyRepository;
        this.companyObjectRepository = companyObjectRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.readinessFixture = readinessFixture;
    }

    public record Tenant(Long companyId, Long objectId, User maker, User checker) {
    }

    public Tenant tenant(String label) {
        long nonce = System.nanoTime();
        Company company = new Company();
        company.setName("ТОО \"Тест " + label + " " + nonce + "\"");
        company.setBin(String.valueOf(400000000000L + Math.abs(nonce % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Основной объект - " + company.getName());
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User maker = user("pek-maker-", UserRole.HEAD);
        User checker = user("pek-checker-", UserRole.HEAD);
        membership(company.getId(), maker);
        membership(company.getId(), checker);
        return new Tenant(company.getId(), object.getId(), maker, checker);
    }

    public User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName(prefix + role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    public void membership(Long companyId, User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    public static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    /** Creates a DRAFT program (one control item) via the API; version 0. */
    public Long createProgram(MockMvc mvc, Tenant t, String validFrom, String validUntil) throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-%d", "name": "Программа ПЭК",
                 "description": "Тестовая программа", "validFrom": "%s", "validUntil": "%s", "responsibleUserId": %d,
                 "facilitySnapshot": {"facilityInformation": "Промплощадка, 1 источник выбросов",
                   "kato": "751010000", "oked": "35111", "environmentalCategory": "II",
                   "designCapacity": "120", "designCapacityUnit": "т/год",
                   "productionCharacteristics": "Производство тепловой энергии"},
                 "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1, "laboratoryId": 1,
                    "measurementMethod": "Инструментальный (ГОСТ 17.2.3.02)"}
                 ]}
                """.formatted(t.companyId(), t.objectId(), System.nanoTime() % 100000, validFrom, validUntil,
                t.maker().getId());
        MvcResult result = mvc.perform(post("/api/pek/programs").with(as(t.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    /** Fills every mandatory section (monitoring directions, points, indicators, inspections, QA/QC,
     *  emergency procedures, responsibility) - see PekProgramReadinessFixture. */
    public void fillSections(Long programId) {
        readinessFixture.makeReady(programId);
    }

    /** DRAFT(v0) -> UNDER_REVIEW (maker) -> APPROVED (checker) -> ACTIVE (checker). Returns version. */
    public long activate(MockMvc mvc, Tenant t, Long programId) throws Exception {
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(t.maker())).header("If-Match", "0"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("UNDER_REVIEW"));
        mvc.perform(post("/api/pek/programs/" + programId + "/approve").with(as(t.checker())).header("If-Match", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
        MvcResult active = mvc.perform(post("/api/pek/programs/" + programId + "/activate").with(as(t.checker()))
                        .header("If-Match", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();
        return Long.parseLong(JsonPath.read(active.getResponse().getContentAsString(), "$.data.version").toString());
    }

    public Long activeProgram(MockMvc mvc, Tenant t, String validFrom, String validUntil) throws Exception {
        Long programId = createProgram(mvc, t, validFrom, validUntil);
        fillSections(programId);
        activate(mvc, t, programId);
        return programId;
    }
}
