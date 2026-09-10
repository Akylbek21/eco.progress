package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.CompanyMembership;
import kz.eco.company.CompanyMembershipRepository;
import kz.eco.company.CompanyMembershipStatus;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.pek.PekMembershipStatus;
import kz.eco.pek.PekStaffAssignment;
import kz.eco.pek.PekStaffAssignmentRepository;
import kz.eco.pek.PekStaffTier;
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
import java.util.stream.Stream;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GET /api/protocols/{id}/pek-links now carries @PreAuthorize(PROTOCOL_VIEW) (module fix, same
 *  gate as GET /{id}) - every PROTOCOL_VIEW role must be able to read it, while POST/PUT/DELETE
 *  stay LAB_PROTOCOL-only (ADMIN/DIRECTOR/HEAD/LABORATORY): MANAGER/ACCOUNTANT/ECOLOGIST/
 *  WASTE_SPECIALIST may view but never mutate pek-links. */
@SpringBootTest
@Transactional
class ProtocolPekLinksAccessApiTest extends ProtocolApiTestSupport {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyMembershipRepository companyMembershipRepository;
    @Autowired private PekStaffAssignmentRepository pekMembershipRepository;

    private MockMvc mvc;
    private Long protocolId;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        MvcResult created = mvc.perform(post("/api/protocols").with(as(labUser))
                        .contentType(MediaType.APPLICATION_JSON).content(createProtocolJson()))
                .andExpect(status().isOk()).andReturn();
        protocolId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@ecoprogress.kz");
        u.setPasswordHash("test");
        u.setName(role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    /** Grants whatever membership each PROTOCOL_VIEW role needs to be in-scope for this test's
     *  protocol/company on BOTH the protocol module's own scope check (ProtocolAccessService,
     *  company/laboratory membership) and the PEK module's independent company-access check
     *  (PekProtocolLinkService.list -> PekAccessService.requireCompanyAccess) - GET pek-links goes
     *  through both. ADMIN/DIRECTOR need neither (global in both modules); HEAD is global only for
     *  the protocol module and still needs a PEK membership. */
    private void grantAccess(User u) {
        if (u.getRole() != UserRole.ADMIN && u.getRole() != UserRole.DIRECTOR) {
            PekStaffAssignment pek = new PekStaffAssignment();
            pek.setCompanyId(companyId);
            pek.setUserId(u.getId());
            pek.setTier(PekStaffTier.defaultForRole(u.getRole()));
            pek.setStatus(PekMembershipStatus.ACTIVE);
            pekMembershipRepository.save(pek);
        }
        if (u.getRole() == UserRole.LABORATORY) {
            LaboratoryEmployee employee = new LaboratoryEmployee();
            employee.setLaboratoryId(laboratoryId);
            employee.setUserId(u.getId());
            employee.setFullName(u.getName());
            employee.setEmail(u.getEmail());
            employee.setPosition("Исполнитель");
            employee.setRole("EXECUTOR");
            employee.setActive(true);
            laboratoryEmployeeRepository.save(employee);
        } else if (u.getRole() != UserRole.ADMIN && u.getRole() != UserRole.DIRECTOR && u.getRole() != UserRole.HEAD) {
            CompanyMembership membership = new CompanyMembership();
            membership.setCompanyId(companyId);
            membership.setUserId(u.getId());
            membership.setRoleCode(u.getRole());
            membership.setStatus(CompanyMembershipStatus.ACTIVE);
            companyMembershipRepository.save(membership);
        }
    }

    private static Stream<UserRole> protocolViewRoles() {
        return Stream.of(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.HEAD, UserRole.LABORATORY,
                UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ECOLOGIST, UserRole.WASTE_SPECIALIST);
    }

    @Test
    void everyProtocolViewRole_canReadPekLinks() throws Exception {
        for (UserRole role : protocolViewRoles().toList()) {
            User u = user("pek-links-view-" + role.name().toLowerCase() + "-", role);
            grantAccess(u);
            mvc.perform(get("/api/protocols/" + protocolId + "/pek-links").with(as(u)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void viewOnlyRoles_cannotCreatePekLink() throws Exception {
        for (UserRole role : List.of(UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ECOLOGIST, UserRole.WASTE_SPECIALIST)) {
            User u = user("pek-links-create-" + role.name().toLowerCase() + "-", role);
            grantAccess(u);
            mvc.perform(post("/api/protocols/" + protocolId + "/pek-links").with(as(u))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void viewOnlyRoles_cannotUpdatePekLink() throws Exception {
        for (UserRole role : List.of(UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ECOLOGIST, UserRole.WASTE_SPECIALIST)) {
            User u = user("pek-links-update-" + role.name().toLowerCase() + "-", role);
            grantAccess(u);
            mvc.perform(put("/api/protocols/" + protocolId + "/pek-links/999999999").with(as(u))
                            .header("If-Match", "0")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void viewOnlyRoles_cannotDeletePekLink() throws Exception {
        for (UserRole role : List.of(UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.ECOLOGIST, UserRole.WASTE_SPECIALIST)) {
            User u = user("pek-links-delete-" + role.name().toLowerCase() + "-", role);
            grantAccess(u);
            mvc.perform(delete("/api/protocols/" + protocolId + "/pek-links/999999999").with(as(u)))
                    .andExpect(status().isForbidden());
        }
    }
}
