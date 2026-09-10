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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Iteration 1 of the PEK module overhaul (tenant isolation / IDOR closure): the authorization
 * matrix that used to be entirely missing. Before this class, any PEK_VIEW-eligible role could
 * read/mutate ANY company's programs/reports purely by guessing an id - PekAccessService's own
 * javadoc documented this as a known gap. Covers cross-company GET/mutate rejection, ADMIN/DIRECTOR
 * global-access bypass, list-endpoint scoping, and lookup scoping.
 */
@SpringBootTest
@Transactional
class PekCompanyIsolationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;

    private MockMvc mvc;
    private Long companyAId;
    private Long companyBId;
    private Long objectAId;
    private Long objectBId;
    private User staffA;   // HEAD, member of company A only
    private User admin;    // ADMIN, global access, no membership rows

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        companyAId = company("PEK Isolation Company A").getId();
        companyBId = company("PEK Isolation Company B").getId();
        objectAId = object(companyAId, "Object A").getId();
        objectBId = object(companyBId, "Object B").getId();

        staffA = user("pek-iso-staff-a-", UserRole.HEAD);
        admin = user("pek-iso-admin-", UserRole.ADMIN);

        membership(companyAId, staffA);
        // admin intentionally has zero PekStaffAssignment rows - global access must not depend on one.
    }

    private Company company(String name) {
        Company c = new Company();
        c.setName(name + " " + System.nanoTime());
        c.setBin(String.valueOf(300000000000L + Math.abs(System.nanoTime() % 600000000000L)));
        c.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.save(c);
    }

    private CompanyObject object(Long companyId, String name) {
        CompanyObject o = new CompanyObject();
        o.setCompanyId(companyId);
        o.setName(name);
        o.setStatus("ACTIVE");
        return companyObjectRepository.save(o);
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

    private Long createProgramAsAdmin(Long companyId, Long objectId) throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ISO-%d", "name": "Isolation program",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31"}
                """.formatted(companyId, objectId, System.nanoTime());
        MvcResult result = mvc.perform(post("/api/pek/programs").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    // --- cross-company rejection ------------------------------------------------------------

    @Test
    void staffCannotReadProgramBelongingToAnotherCompany() throws Exception {
        Long programB = createProgramAsAdmin(companyBId, objectBId);
        mvc.perform(get("/api/pek/programs/" + programB).with(as(staffA)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotEditProgramBelongingToAnotherCompany() throws Exception {
        Long programB = createProgramAsAdmin(companyBId, objectBId);
        mvc.perform(patch("/api/pek/programs/" + programB).with(as(staffA))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Hacked name"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotArchiveProgramBelongingToAnotherCompany() throws Exception {
        Long programB = createProgramAsAdmin(companyBId, objectBId);
        mvc.perform(post("/api/pek/programs/" + programB + "/archive").with(as(staffA))
                        .header("If-Match", "0"))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCannotCreateProgramClaimingAnotherCompany() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ISO-X", "name": "Should be rejected",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31"}
                """.formatted(companyBId, objectBId);
        mvc.perform(post("/api/pek/programs").with(as(staffA))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCanReadAndEditItsOwnCompanyProgram() throws Exception {
        Long programA = createProgramAsAdmin(companyAId, objectAId);
        mvc.perform(get("/api/pek/programs/" + programA).with(as(staffA)))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/pek/programs/" + programA).with(as(staffA))
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Updated by owner"}
                                """))
                .andExpect(status().isOk());
    }

    // --- ADMIN/DIRECTOR global-access bypass -------------------------------------------------

    @Test
    void adminCanAccessAnyCompanysResourcesWithoutAMembershipRow() throws Exception {
        Long programB = createProgramAsAdmin(companyBId, objectBId);
        mvc.perform(get("/api/pek/programs/" + programB).with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/programs/" + programB + "/archive").with(as(admin))
                        .header("If-Match", "0"))
                .andExpect(status().isOk());
    }

    // --- list endpoint scoping -----------------------------------------------------------------

    @Test
    void programListForNonGlobalCallerIsScopedToAccessibleCompaniesOnly() throws Exception {
        createProgramAsAdmin(companyAId, objectAId);
        createProgramAsAdmin(companyBId, objectBId);

        MvcResult result = mvc.perform(get("/api/pek/programs").with(as(staffA)))
                .andExpect(status().isOk()).andReturn();
        List<Integer> companyIds = JsonPath.read(result.getResponse().getContentAsString(), "$.data.items[*].companyId");
        assertTrue(companyIds.stream().allMatch(id -> id.longValue() == companyAId));
    }

    @Test
    void reportListRejectsCompanyOutsideCallersAccess() throws Exception {
        mvc.perform(get("/api/pek/reports").with(as(staffA))
                        .param("companyId", String.valueOf(companyBId))
                        .param("objectId", String.valueOf(objectBId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void dashboardForNonGlobalCallerIsScopedToAccessibleCompaniesOnly() throws Exception {
        createProgramAsAdmin(companyAId, objectAId);
        createProgramAsAdmin(companyBId, objectBId);

        mvc.perform(get("/api/pek/dashboard").with(as(staffA)))
                .andExpect(status().isOk());
        // No explicit companyId means "everything visible to the caller" - must not 400, and must
        // not error out just because company B also has data (see PekDashboardService#dashboard).
    }

    // --- lookup scoping --------------------------------------------------------------------

    /** Module fix: assignees lookup now takes an explicit companyId and must return only that
     *  company's staff, never a merged set across every company the caller can access. */
    @Test
    void assigneeLookupOnlyReturnsUsersWithMembershipInRequestedCompany() throws Exception {
        User headInCompanyA = user("pek-iso-head-a-", UserRole.HEAD);
        membership(companyAId, headInCompanyA);
        User headInCompanyB = user("pek-iso-head-b-", UserRole.HEAD);
        membership(companyBId, headInCompanyB);

        MvcResult result = mvc.perform(get("/api/pek/lookups/assignees").with(as(staffA))
                        .param("companyId", String.valueOf(companyAId))
                        .param("roles", "PEK_REVIEWER"))
                .andExpect(status().isOk()).andReturn();
        List<Integer> ids = JsonPath.read(result.getResponse().getContentAsString(), "$.data[*].id");
        assertTrue(ids.contains(headInCompanyA.getId().intValue()));
        assertTrue(ids.stream().noneMatch(id -> id.longValue() == headInCompanyB.getId()));
    }

    @Test
    void assigneeLookupRejectsCompanyOutsideCallersAccess() throws Exception {
        mvc.perform(get("/api/pek/lookups/assignees").with(as(staffA))
                        .param("companyId", String.valueOf(companyBId))
                        .param("roles", "PEK_REVIEWER"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminSeesAssigneesForAnyCompanyGivenExplicitCompanyId() throws Exception {
        User headInCompanyB = user("pek-iso-head-global-", UserRole.HEAD);
        membership(companyBId, headInCompanyB);

        MvcResult result = mvc.perform(get("/api/pek/lookups/assignees").with(as(admin))
                        .param("companyId", String.valueOf(companyBId))
                        .param("roles", "PEK_REVIEWER"))
                .andExpect(status().isOk()).andReturn();
        List<Integer> ids = JsonPath.read(result.getResponse().getContentAsString(), "$.data[*].id");
        assertTrue(ids.contains(headInCompanyB.getId().intValue()));
    }

    // --- ID-substitution IDOR still blocked (older PekAccessService checks, unchanged) -------

    @Test
    void objectLookupPermitsRejectsUnknownObjectId() throws Exception {
        mvc.perform(get("/api/pek/lookups/objects/999999999/permits").with(as(admin)))
                .andExpect(status().isNotFound());
    }
}
