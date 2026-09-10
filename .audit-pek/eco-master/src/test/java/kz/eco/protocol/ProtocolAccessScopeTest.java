package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyMembership;
import kz.eco.company.CompanyMembershipRepository;
import kz.eco.company.CompanyMembershipStatus;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P0 module fix item 2: {@code PROTOCOL_VIEW} (and LAB_PROTOCOL) only ever mean "may use this
 * section of the app" - they must never by themselves mean "may read/act on any protocol in the
 * system". Every scenario here creates a protocol belonging to one company/laboratory and proves
 * an actor with a real PROTOCOL_VIEW-eligible role but NO real relationship to that specific
 * protocol (no company membership, no laboratory employment, no PEK link) is rejected - by the
 * exact same {@link ProtocolAccessService} used for list/get/audit/download/calculation/mutation.
 */
@SpringBootTest
@Transactional
class ProtocolAccessScopeTest extends ProtocolApiTestSupport {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyMembershipRepository companyMembershipRepository;
    @Autowired private ProtocolRepository protocolRepository;

    private MockMvc mvc;
    private Long ownProtocolId;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        seedProtocolFixtures();

        ownProtocolId = Long.parseLong(createProtocolAs(labUser));
    }

    private String createProtocolAs(User actor) throws Exception {
        var result = mvc.perform(post("/api/protocols")
                        .with(as(actor))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
    }

    private User staffUser(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + "-" + System.nanoTime() + "@ecoprogress.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name() + " Tester");
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private void grantCompanyMembership(User user, Long companyIdToGrant) {
        CompanyMembership membership = new CompanyMembership();
        membership.setCompanyId(companyIdToGrant);
        membership.setUserId(user.getId());
        membership.setRoleCode(user.getRole());
        membership.setStatus(CompanyMembershipStatus.ACTIVE);
        companyMembershipRepository.save(membership);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    // ---- ADMIN: global access ----------------------------------------------------------------

    @Test
    void admin_seesGlobalProtocolList_andCanOpenAnyProtocol() throws Exception {
        User admin = staffUser("admin", UserRole.ADMIN);
        mvc.perform(get("/api/protocols").with(as(admin)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/protocols/" + ownProtocolId).with(as(admin)))
                .andExpect(status().isOk());
    }

    // ---- MANAGER: company-membership-scoped, no membership -> 403 -----------------------------

    @Test
    void manager_withoutMembership_cannotOpenForeignProtocol() throws Exception {
        User manager = staffUser("manager", UserRole.MANAGER);
        mvc.perform(get("/api/protocols/" + ownProtocolId).with(as(manager)))
                .andExpect(status().isForbidden());
    }

    @Test
    void manager_withMembership_canOpenOwnCompanyProtocol() throws Exception {
        User manager = staffUser("manager", UserRole.MANAGER);
        grantCompanyMembership(manager, companyId);
        mvc.perform(get("/api/protocols/" + ownProtocolId).with(as(manager)))
                .andExpect(status().isOk());
    }

    @Test
    void manager_withoutMembership_listDoesNotIncludeForeignProtocol() throws Exception {
        User manager = staffUser("manager", UserRole.MANAGER);
        mvc.perform(get("/api/protocols").with(as(manager)).param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == '" + ownProtocolId + "')]").isEmpty());
    }

    // ---- ECOLOGIST: same company-membership scoping --------------------------------------------

    @Test
    void ecologist_withoutMembership_cannotOpenForeignCompanyOrOrderProtocol() throws Exception {
        User ecologist = staffUser("ecologist", UserRole.ECOLOGIST);
        mvc.perform(get("/api/protocols/" + ownProtocolId).with(as(ecologist)))
                .andExpect(status().isForbidden());
    }

    // ---- ACCOUNTANT: never a global view, even with the PROTOCOL_VIEW role ---------------------

    @Test
    void accountant_withoutMembership_getsNoGlobalListAccessToForeignProtocol() throws Exception {
        User accountant = staffUser("accountant", UserRole.ACCOUNTANT);
        mvc.perform(get("/api/protocols").with(as(accountant)).param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == '" + ownProtocolId + "')]").isEmpty());
        mvc.perform(get("/api/protocols/" + ownProtocolId).with(as(accountant)))
                .andExpect(status().isForbidden());
    }

    // ---- LABORATORY: only protocols of a laboratory this user actually works at ----------------

    @Test
    void laboratory_notEmployedAtOwningLab_cannotOpenForeignLabProtocol() throws Exception {
        Laboratory foreignLab = new Laboratory();
        foreignLab.setName("Foreign Lab " + System.nanoTime());
        foreignLab.setLegalName("Foreign Lab LLP");
        foreignLab.setAddress("Somewhere else");
        foreignLab.setAccreditationNumber("KZ.FOREIGN." + System.nanoTime());
        foreignLab.setAccreditationIssuedAt(java.time.LocalDate.of(2020, 1, 1));
        foreignLab.setAccreditationValidUntil(java.time.LocalDate.of(2030, 12, 31));
        foreignLab.setDirectorName("Director");
        foreignLab.setLaboratoryHeadName("Head");
        foreignLab.setActive(true);
        laboratoryRepository.save(foreignLab);

        User foreignLabTech = staffUser("foreign-lab", UserRole.LABORATORY);
        // Not registered as a LaboratoryEmployee of foreignLab OR of the fixture's laboratory -
        // has the LABORATORY role (so LAB_PROTOCOL/PROTOCOL_VIEW pass) but zero real scope.
        mvc.perform(get("/api/protocols/" + ownProtocolId).with(as(foreignLabTech)))
                .andExpect(status().isForbidden());
    }

    // ---- Direct GET on a nonexistent id: still 404, not 403 ------------------------------------

    @Test
    void directGet_nonExistentProtocol_is404NotForbidden() throws Exception {
        User admin = staffUser("admin", UserRole.ADMIN);
        mvc.perform(get("/api/protocols/999999999").with(as(admin)))
                .andExpect(status().isNotFound());
    }

    // ---- audit / download / mutation of a foreign protocol all 403, same access service --------

    @Test
    void audit_ofForeignProtocol_isForbidden() throws Exception {
        User manager = staffUser("manager", UserRole.MANAGER);
        mvc.perform(get("/api/protocols/" + ownProtocolId + "/audit").with(as(manager)))
                .andExpect(status().isForbidden());
    }

    @Test
    void downloadPdf_ofForeignProtocol_isForbidden() throws Exception {
        User foreignLabTech = staffUser("foreign-lab2", UserRole.LABORATORY);
        mvc.perform(get("/api/protocols/" + ownProtocolId + "/download-pdf").with(as(foreignLabTech)))
                .andExpect(status().isForbidden());
    }

    @Test
    void downloadDocx_ofForeignProtocol_isForbidden() throws Exception {
        User foreignLabTech = staffUser("foreign-lab3", UserRole.LABORATORY);
        mvc.perform(get("/api/protocols/" + ownProtocolId + "/download-docx").with(as(foreignLabTech)))
                .andExpect(status().isForbidden());
    }

    @Test
    void mutation_ofForeignProtocol_isForbidden() throws Exception {
        User foreignLabTech = staffUser("foreign-lab4", UserRole.LABORATORY);
        mvc.perform(patch("/api/protocols/" + ownProtocolId)
                        .with(as(foreignLabTech))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void calculate_ofForeignProtocol_isForbidden() throws Exception {
        User foreignLabTech = staffUser("foreign-lab5", UserRole.LABORATORY);
        mvc.perform(post("/api/protocols/" + ownProtocolId + "/calculate")
                        .with(as(foreignLabTech))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0}"))
                .andExpect(status().isForbidden());
    }
}
