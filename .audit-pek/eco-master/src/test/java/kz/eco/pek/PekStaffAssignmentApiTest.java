package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
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

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Module fix item 1: PekStaffAssignment (not pek_company_memberships) is now the real source of
 *  truth PekAccessService reads for company scope/permission resolution, and it must never be
 *  possible to assign a CLIENT-role account as if it were PEK staff of a company. Module fix item
 *  3: every mutation on this versioned entity requires If-Match. */
@SpringBootTest
@Transactional
class PekStaffAssignmentApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository assignmentRepository;

    private MockMvc mvc;
    private Long companyId;
    private User admin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Staff Assignment Test " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        admin = user("pek-staff-admin-", UserRole.ADMIN);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName(role.name());
        u.setRole(role);
        u.setType(role == UserRole.CLIENT ? ClientType.individual : ClientType.staff);
        return userRepository.save(u);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    // ---- module fix item 1: never a client-role "employee" -----------------------------------

    @Test
    void assigningAClientRoleAccount_isRejected() throws Exception {
        User client = user("pek-staff-client-", UserRole.CLIENT);
        String body = """
                {"email":"%s","tier":"EDITOR"}
                """.formatted(client.getEmail());
        mvc.perform(post("/api/pek/companies/" + companyId + "/staff").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_STAFF_ASSIGNMENT_NOT_STAFF_ACCOUNT"));
    }

    @Test
    void assigningAStaffAccount_succeeds_andGrantsCompanyAccess() throws Exception {
        User ecologist = user("pek-staff-ecologist-", UserRole.ECOLOGIST);
        String body = """
                {"email":"%s","tier":"EDITOR"}
                """.formatted(ecologist.getEmail());
        mvc.perform(post("/api/pek/companies/" + companyId + "/staff").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tier").value("EDITOR"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        // The assignment is real access, not decorative - the assignee can now see this company's
        // program list (PEK_VIEW role gate, which ECOLOGIST passes, plus PekAccessService's
        // requireCompanyAccess company-scope gate, which the new PekStaffAssignment row grants).
        mvc.perform(get("/api/pek/programs").param("companyId", companyId.toString()).with(as(ecologist)))
                .andExpect(status().isOk());
    }

    // ---- module fix item 3: If-Match mandatory on this versioned entity too -------------------

    @Test
    void update_withoutIfMatch_returns400() throws Exception {
        Long assignmentId = assignEcologist();
        mvc.perform(patch("/api/pek/companies/" + companyId + "/staff/" + assignmentId).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tier\":\"REVIEWER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    @Test
    void update_withStaleIfMatch_returns409() throws Exception {
        Long assignmentId = assignEcologist();
        mvc.perform(patch("/api/pek/companies/" + companyId + "/staff/" + assignmentId).with(as(admin))
                        .header("If-Match", "99")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tier\":\"REVIEWER\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
    }

    @Test
    void update_withCorrectIfMatch_succeeds_andBumpsVersion() throws Exception {
        Long assignmentId = assignEcologist();
        mvc.perform(patch("/api/pek/companies/" + companyId + "/staff/" + assignmentId).with(as(admin))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tier\":\"REVIEWER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tier").value("REVIEWER"))
                .andExpect(jsonPath("$.data.version").value(1));
    }

    @Test
    void remove_withoutIfMatch_returns400() throws Exception {
        Long assignmentId = assignEcologist();
        mvc.perform(delete("/api/pek/companies/" + companyId + "/staff/" + assignmentId).with(as(admin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    @Test
    void remove_withCorrectIfMatch_succeeds() throws Exception {
        Long assignmentId = assignEcologist();
        mvc.perform(delete("/api/pek/companies/" + companyId + "/staff/" + assignmentId).with(as(admin))
                        .header("If-Match", "0"))
                .andExpect(status().isOk());
        assertEquals(PekMembershipStatus.REMOVED, assignmentRepository.findById(assignmentId).orElseThrow().getStatus());
    }

    private Long assignEcologist() throws Exception {
        User ecologist = user("pek-staff-eco-", UserRole.ECOLOGIST);
        String body = """
                {"email":"%s","tier":"EDITOR"}
                """.formatted(ecologist.getEmail());
        MvcResult result = mvc.perform(post("/api/pek/companies/" + companyId + "/staff").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }
}
