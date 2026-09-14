package kz.eco.company;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.security.crypto.password.PasswordEncoder;
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

/**
 * Covers the two gaps closed in this pass: (1) a non-global-access creator (MANAGER) automatically
 * gets ACTIVE membership on the company it just created, so it isn't locked out of its own new
 * company; (2) the company_memberships CRUD API (list/add/update-role-status/remove).
 */
@SpringBootTest
@Transactional
class CompanyMembershipApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CompanyMembershipRepository membershipRepository;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name() + " " + prefix);
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private Long createCompanyAs(User actor, String name, String bin) throws Exception {
        String json = """
                {"name": "%s", "bin": "%s", "legalAddress": "г. Алматы", "phone": "+77011234567"}
                """.formatted(name, bin);
        MvcResult result = mvc.perform(post("/api/companies").with(as(actor))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    // ---- creator auto-membership --------------------------------------------------------------

    @Test
    void managerCreatingACompany_immediatelySeesItWithNoManualMembership() throws Exception {
        User manager = user("mem-creator-", UserRole.MANAGER);
        Long companyId = createCompanyAs(manager, "ТОО Автор Менеджер", "400500600701");

        mvc.perform(get("/api/companies/" + companyId).with(as(manager)))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/companies/" + companyId).with(as(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Renamed by creator","version":0}
                                """))
                .andExpect(status().isOk());
        mvc.perform(get("/api/companies/" + companyId + "/objects").with(as(manager)))
                .andExpect(status().isOk());
    }

    @Test
    void otherManagerWithNoMembership_getsForbiddenOnTheSameCompany() throws Exception {
        User creator = user("mem-creator-", UserRole.MANAGER);
        User other = user("mem-other-", UserRole.MANAGER);
        Long companyId = createCompanyAs(creator, "ТОО Чужой Менеджер", "400500600702");

        mvc.perform(get("/api/companies/" + companyId).with(as(other)))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/companies/" + companyId).with(as(other))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/companies/" + companyId + "/objects").with(as(other)))
                .andExpect(status().isForbidden());
    }

    /** A non-global-access role with zero memberships is denied (403) before the company's
     *  existence is even checked - CompanyAccessService never leaks existence to a non-member.
     *  True 404-for-nonexistent-id is only observable for a global-access role (see below). */
    @Test
    void nonexistentCompanyId_forNonMember_returns403NotLeakingExistence() throws Exception {
        User manager = user("mem-404-", UserRole.MANAGER);
        mvc.perform(get("/api/companies/999999999").with(as(manager)))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonexistentCompanyId_forGlobalAccessRole_returns404() throws Exception {
        User admin = user("mem-404-admin-", UserRole.ADMIN);
        mvc.perform(get("/api/companies/999999999").with(as(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminCreatingACompany_getsNoMembershipRow_globalBypassAlreadyCoversIt() throws Exception {
        User admin = user("mem-admin-", UserRole.ADMIN);
        Long companyId = createCompanyAs(admin, "ТОО Админ Создатель", "400500600703");
        assertEquals(0, membershipRepository.findByCompanyIdOrderByCreatedAtAsc(companyId).size());
    }

    @Test
    void directorBypassesWithoutAnyMembershipRow() throws Exception {
        User director = user("mem-director-", UserRole.DIRECTOR);
        User manager = user("mem-other-dir-", UserRole.MANAGER);
        Long companyId = createCompanyAs(manager, "ТОО Директор Обход", "400500600704");

        mvc.perform(get("/api/companies/" + companyId).with(as(director)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/companies/" + companyId + "/archive").param("version", "0").with(as(director)))
                .andExpect(status().isOk());
    }

    // ---- membership CRUD -----------------------------------------------------------------------

    @Test
    void addListUpdateAndRemoveMembershipFlow() throws Exception {
        User owner = user("mem-owner-", UserRole.MANAGER);
        User colleague = user("mem-colleague-", UserRole.HEAD);
        Long companyId = createCompanyAs(owner, "ТОО Команда", "400500600705");

        // add
        String addJson = """
                {"email":"%s","roleCode":"HEAD"}
                """.formatted(colleague.getEmail());
        MvcResult added = mvc.perform(post("/api/companies/" + companyId + "/members").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.roleCode").value("HEAD"))
                .andReturn();
        Long membershipId = Long.valueOf(JsonPath.read(added.getResponse().getContentAsString(), "$.data.id").toString());

        // colleague now has access
        mvc.perform(get("/api/companies/" + companyId).with(as(colleague)))
                .andExpect(status().isOk());

        // list
        mvc.perform(get("/api/companies/" + companyId + "/members").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2)) // owner (auto) + colleague
                .andExpect(jsonPath("$.data[?(@.userEmail=='" + colleague.getEmail() + "')]").exists());

        // update role
        mvc.perform(patch("/api/companies/" + companyId + "/members/" + membershipId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roleCode\":\"MANAGER\",\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleCode").value("MANAGER"))
                .andExpect(jsonPath("$.data.version").value(1));

        // deactivate via PATCH status
        mvc.perform(patch("/api/companies/" + companyId + "/members/" + membershipId).with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\",\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("INACTIVE"));

        // colleague loses access now
        mvc.perform(get("/api/companies/" + companyId).with(as(colleague)))
                .andExpect(status().isForbidden());
    }

    @Test
    void removeEndpoint_deactivatesMembership() throws Exception {
        User owner = user("mem-owner2-", UserRole.MANAGER);
        User colleague = user("mem-colleague2-", UserRole.HEAD);
        Long companyId = createCompanyAs(owner, "ТОО Удаление", "400500600706");

        String addJson = """
                {"email":"%s","roleCode":"HEAD"}
                """.formatted(colleague.getEmail());
        MvcResult added = mvc.perform(post("/api/companies/" + companyId + "/members").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk()).andReturn();
        Long membershipId = Long.valueOf(JsonPath.read(added.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(delete("/api/companies/" + companyId + "/members/" + membershipId).param("version", "0").with(as(owner)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/companies/" + companyId).with(as(colleague)))
                .andExpect(status().isForbidden());
    }

    @Test
    void reAddingADeactivatedMember_reactivatesRatherThanDuplicates() throws Exception {
        User owner = user("mem-owner3-", UserRole.MANAGER);
        User colleague = user("mem-colleague3-", UserRole.ECOLOGIST);
        Long companyId = createCompanyAs(owner, "ТОО Повторное Добавление", "400500600707");

        String addJson = """
                {"email":"%s","roleCode":"ECOLOGIST"}
                """.formatted(colleague.getEmail());
        mvc.perform(post("/api/companies/" + companyId + "/members").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk());
        mvc.perform(post("/api/companies/" + companyId + "/members").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk());

        long rowsForColleague = membershipRepository.findByCompanyIdOrderByCreatedAtAsc(companyId).stream()
                .filter(m -> m.getUserId().equals(colleague.getId())).count();
        assertEquals(1, rowsForColleague, "re-adding must reactivate the existing row, not create a second one");
    }

    @Test
    void memberManagementEndpoints_requireCompanyAccessNotJustRole() throws Exception {
        // A MANAGER (COMPANY_EDIT role) with no membership on this specific company must still 403.
        User creator = user("mem-owner4-", UserRole.MANAGER);
        User outsider = user("mem-outsider-", UserRole.MANAGER);
        Long companyId = createCompanyAs(creator, "ТОО Не Мой Доступ", "400500600708");

        mvc.perform(get("/api/companies/" + companyId + "/members").with(as(outsider)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/companies/" + companyId + "/members").with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"x@test.kz\",\"roleCode\":\"MANAGER\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void addingUnknownEmail_returns404() throws Exception {
        User owner = user("mem-owner5-", UserRole.MANAGER);
        Long companyId = createCompanyAs(owner, "ТОО Неизвестный Email", "400500600709");

        mvc.perform(post("/api/companies/" + companyId + "/members").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody-registered@test.kz\",\"roleCode\":\"MANAGER\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    // ---- archive/restore gated by membership, not role alone ----------------------------------

    @Test
    void headWithoutMembership_cannotArchiveDespiteRoleGatePermittingArchive() throws Exception {
        User creator = user("mem-head-owner-", UserRole.MANAGER);
        User headOutsider = user("mem-head-outsider-", UserRole.HEAD);
        Long companyId = createCompanyAs(creator, "ТОО HEAD Без Доступа", "400500600710");

        mvc.perform(post("/api/companies/" + companyId + "/archive").param("version", "0").with(as(headOutsider)))
                .andExpect(status().isForbidden());
    }

    @Test
    void headWithMembership_canArchiveAndRestore() throws Exception {
        User creator = user("mem-head-owner2-", UserRole.MANAGER);
        User head = user("mem-head-member-", UserRole.HEAD);
        Long companyId = createCompanyAs(creator, "ТОО HEAD С Доступом", "400500600711");

        String addJson = """
                {"email":"%s","roleCode":"HEAD"}
                """.formatted(head.getEmail());
        mvc.perform(post("/api/companies/" + companyId + "/members").with(as(creator))
                        .contentType(MediaType.APPLICATION_JSON).content(addJson))
                .andExpect(status().isOk());

        mvc.perform(post("/api/companies/" + companyId + "/archive").param("version", "0").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
        mvc.perform(post("/api/companies/" + companyId + "/restore").param("version", "1").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void objectArchiveAndRestore_gatedByCompanyMembership() throws Exception {
        // HEAD (not MANAGER): archiving requires COMPANY_ARCHIVE at the role-gate layer too, and
        // MANAGER isn't in that role set - HEAD is, so this isolates the membership check itself.
        User creator = user("mem-obj-owner-", UserRole.HEAD);
        Long companyId = createCompanyAs(creator, "ТОО Объекты Доступ", "400500600712");
        String objectsResponse = mvc.perform(get("/api/companies/" + companyId + "/objects").with(as(creator)))
                .andReturn().getResponse().getContentAsString();
        Long objectId = Long.valueOf(JsonPath.read(objectsResponse, "$.data[0].id").toString());

        User outsider = user("mem-obj-outsider-", UserRole.HEAD);
        mvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/archive").param("version", "0").with(as(outsider)))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/archive").param("version", "0").with(as(creator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
        mvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/restore").param("version", "1").with(as(creator)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    // ---- /api/auth/me COMPANY_CREATE key -------------------------------------------------------

    @Test
    void meEndpoint_includesCompanyCreatePermission_forManager() throws Exception {
        User manager = user("mem-me-manager-", UserRole.MANAGER);
        mvc.perform(get("/api/auth/me").with(as(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_CREATE").value(true));
    }

    @Test
    void meEndpoint_includesCompanyCreatePermission_falseForLaboratory() throws Exception {
        User lab = user("mem-me-lab-", UserRole.LABORATORY);
        mvc.perform(get("/api/auth/me").with(as(lab)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_CREATE").value(false));
    }
}
