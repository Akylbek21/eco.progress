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

/** CRUD for pek_company_memberships (module spec item 2), mirroring CompanyMembershipApiTest's
 *  structure for the analogous kz.eco.company module. */
@SpringBootTest
@Transactional
class PekCompanyMembershipApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekCompanyMembershipRepository membershipRepository;
    @Autowired private PekStaffAssignmentRepository staffAssignmentRepository;

    private MockMvc mvc;
    private Long companyId;
    private User admin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("PEK Membership Test " + System.nanoTime());
        company.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        admin = user("pek-mem-admin-", UserRole.ADMIN);
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

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    @Test
    void addListUpdateAndRemoveMembershipFlow() throws Exception {
        User colleague = user("pek-mem-colleague-", UserRole.HEAD);

        String addJson = """
                {"email":"%s","roleCode":"HEAD"}
                """.formatted(colleague.getEmail());
        MvcResult added = mvc.perform(post("/api/pek/companies/" + companyId + "/members").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.roleCode").value("HEAD"))
                .andReturn();
        Long membershipId = Long.valueOf(JsonPath.read(added.getResponse().getContentAsString(), "$.data.id").toString());

        // Module fix: pek_company_memberships no longer grants any access on its own (module fix
        // item 1) - a real PekStaffAssignment row is what colleague needs to manage this
        // company's (legacy) members themselves.
        PekStaffAssignment colleagueAssignment = new PekStaffAssignment();
        colleagueAssignment.setCompanyId(companyId);
        colleagueAssignment.setUserId(colleague.getId());
        colleagueAssignment.setTier(PekStaffTier.defaultForRole(colleague.getRole()));
        staffAssignmentRepository.save(colleagueAssignment);

        mvc.perform(get("/api/pek/companies/" + companyId + "/members").with(as(colleague)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(get("/api/pek/companies/" + companyId + "/members").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].userEmail").value(colleague.getEmail()));

        mvc.perform(patch("/api/pek/companies/" + companyId + "/members/" + membershipId).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roleCode\":\"MANAGER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleCode").value("MANAGER"));

        mvc.perform(delete("/api/pek/companies/" + companyId + "/members/" + membershipId).with(as(admin)))
                .andExpect(status().isOk());

        PekCompanyMembership reloaded = membershipRepository.findById(membershipId).orElseThrow();
        assertEquals(PekMembershipStatus.REMOVED, reloaded.getStatus());
    }

    @Test
    void reAddingARemovedMember_reactivatesRatherThanDuplicates() throws Exception {
        User colleague = user("pek-mem-readd-", UserRole.HEAD);
        String addJson = """
                {"email":"%s","roleCode":"HEAD"}
                """.formatted(colleague.getEmail());

        mvc.perform(post("/api/pek/companies/" + companyId + "/members").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/companies/" + companyId + "/members").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk());

        long rows = membershipRepository.findByCompanyIdOrderByCreatedAtAsc(companyId).stream()
                .filter(m -> m.getUserId().equals(colleague.getId())).count();
        assertEquals(1, rows, "re-adding must reactivate the existing row, not create a second one");
    }

    @Test
    void addingUnknownEmail_returns404() throws Exception {
        mvc.perform(post("/api/pek/companies/" + companyId + "/members").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody-registered@test.kz\",\"roleCode\":\"HEAD\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    @Test
    void nonElevatedRoleCannotManageMembers() throws Exception {
        User manager = user("pek-mem-forbidden-", UserRole.ECOLOGIST);
        mvc.perform(get("/api/pek/companies/" + companyId + "/members").with(as(manager)))
                .andExpect(status().isForbidden());
    }

    @Test
    void managingMembersOfAnotherCompanyRequiresAccess_evenForElevatedRole() throws Exception {
        // A HEAD user (PEK_SETTINGS_EDIT-eligible role) with no membership of THIS company must
        // still be denied - the role gate alone is not the access boundary.
        User headOutsider = user("pek-mem-outsider-", UserRole.HEAD);
        mvc.perform(get("/api/pek/companies/" + companyId + "/members").with(as(headOutsider)))
                .andExpect(status().isForbidden());
    }
}
