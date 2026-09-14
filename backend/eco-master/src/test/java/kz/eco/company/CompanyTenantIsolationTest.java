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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tenant isolation for the Companies module (previously absent entirely - any COMPANY_ACCESS role
 * could read/mutate ANY companyId by guessing an id, same class of gap PekCompanyIsolationTest
 * closed for PEK). Also covers the COMPANY_* permission matrix on /api/auth/me and the
 * archived-company 409 guard on object restore.
 */
@SpringBootTest
@Transactional
class CompanyTenantIsolationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CompanyMembershipRepository membershipRepository;

    private MockMvc mvc;
    private User admin;      // global access, no membership rows
    private User staffA;     // HEAD, member of company A only

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = user("company-iso-admin-", UserRole.ADMIN);
        staffA = user("company-iso-staff-a-", UserRole.HEAD);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private void membership(Long companyId, User user) {
        CompanyMembership m = new CompanyMembership();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setRoleCode(user.getRole());
        m.setStatus(CompanyMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private Long createCompany(String name, String bin) throws Exception {
        String json = """
                {"name": "%s", "bin": "%s", "legalAddress": "г. Алматы", "phone": "+77011234567"}
                """.formatted(name, bin);
        MvcResult result = mvc.perform(post("/api/companies").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    // ---- cross-company rejection ------------------------------------------------------------

    @Test
    void staffCannotReadCompanyBelongingToAnotherCompany() throws Exception {
        Long companyB = createCompany("ТОО Изоляция Б", "300400500601");
        mvc.perform(get("/api/companies/" + companyB).with(as(staffA)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotEditCompanyBelongingToAnotherCompany() throws Exception {
        Long companyB = createCompany("ТОО Изоляция В", "300400500602");
        mvc.perform(patch("/api/companies/" + companyB).with(as(staffA))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Hacked name"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotArchiveCompanyBelongingToAnotherCompany() throws Exception {
        Long companyB = createCompany("ТОО Изоляция Г", "300400500603");
        mvc.perform(post("/api/companies/" + companyB + "/archive").param("version", "0").with(as(staffA)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotListObjectsOfAnotherCompany() throws Exception {
        Long companyB = createCompany("ТОО Изоляция Д", "300400500604");
        mvc.perform(get("/api/companies/" + companyB + "/objects").with(as(staffA)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCanReadAndEditItsOwnCompany() throws Exception {
        Long companyA = createCompany("ТОО Изоляция Е", "300400500605");
        membership(companyA, staffA);
        mvc.perform(get("/api/companies/" + companyA).with(as(staffA)))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/companies/" + companyA).with(as(staffA))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Updated by owner","version":0}
                                """))
                .andExpect(status().isOk());
    }

    // ---- ADMIN/DIRECTOR global-access bypass -------------------------------------------------

    @Test
    void adminCanAccessAnyCompanyWithoutAMembershipRow() throws Exception {
        Long companyB = createCompany("ТОО Изоляция Ж", "300400500606");
        mvc.perform(get("/api/companies/" + companyB).with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/companies/" + companyB + "/archive").param("version", "0").with(as(admin)))
                .andExpect(status().isOk());
    }

    // ---- list/search scoping ------------------------------------------------------------------

    @Test
    void listIsScopedToAccessibleCompaniesOnly() throws Exception {
        Long companyA = createCompany("ТОО Изоляция Список А", "300400500607");
        createCompany("ТОО Изоляция Список Б", "300400500608");
        membership(companyA, staffA);

        MvcResult result = mvc.perform(get("/api/companies").param("size", "100").with(as(staffA)))
                .andExpect(status().isOk()).andReturn();
        List<Integer> ids = JsonPath.read(result.getResponse().getContentAsString(), "$.data.items[*].id");
        assertTrue(ids.contains(companyA.intValue()));
        assertEquals(1, ids.size());
    }

    // ---- restore-on-archived-company 409 -----------------------------------------------------

    @Test
    void restoreObject_forArchivedCompany_returns409() throws Exception {
        Long companyId = createCompany("ТОО Архив Объект", "300400500609");
        String objectsResponse = mvc.perform(get("/api/companies/" + companyId + "/objects").with(as(admin)))
                .andReturn().getResponse().getContentAsString();
        Long objectId = Long.valueOf(JsonPath.read(objectsResponse, "$.data[0].id").toString());

        mvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/archive").param("version", "0").with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/companies/" + companyId + "/archive").param("version", "0").with(as(admin)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/companies/" + companyId + "/objects/" + objectId + "/restore").param("version", "1").with(as(admin)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMPANY_ARCHIVED"));
    }

    // ---- DELETE is soft-archive only, never physical -----------------------------------------

    @Test
    void deleteEndpoint_softArchivesInsteadOfPhysicalDelete() throws Exception {
        Long companyId = createCompany("ТОО Мягкое Удаление", "300400500610");
        mvc.perform(delete("/api/companies/" + companyId).param("version", "0").with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/companies/" + companyId).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    // ---- COMPANY_* permission matrix on /api/auth/me -----------------------------------------

    @Test
    void meEndpoint_returnsCompanyPermissionsMatrix_forAdmin() throws Exception {
        mvc.perform(get("/api/auth/me").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_VIEW").value(true))
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_EDIT").value(true))
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_ARCHIVE").value(true));
    }

    @Test
    void meEndpoint_returnsCompanyPermissionsMatrix_forLaboratoryReadOnly() throws Exception {
        User lab = user("company-iso-lab-", UserRole.LABORATORY);
        mvc.perform(get("/api/auth/me").with(as(lab)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_VIEW").value(true))
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_EDIT").value(false))
                .andExpect(jsonPath("$.data.companyPermissions.COMPANY_ARCHIVE").value(false));
    }
}
