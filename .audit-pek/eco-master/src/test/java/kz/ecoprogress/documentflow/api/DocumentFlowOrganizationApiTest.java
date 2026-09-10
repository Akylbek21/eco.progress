package kz.ecoprogress.documentflow.api;

import kz.eco.EcoApplication;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Module spec §4: a user who belongs to more than one organization must be able to discover them
 * (GET /organizations) and explicitly pick one for /access, instead of the endpoint silently
 * degrading to "no access" (the pre-existing OrganizationResolver ambiguity behavior - see
 * OrganizationResolverTest - stays unchanged; this only wires the parameter through).
 */
@SpringBootTest(classes = EcoApplication.class)
@Transactional
class DocumentFlowOrganizationApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowTestFixtures fixtures;

    private MockMvc mockMvc;
    private User user;
    private Long orgA;
    private Long orgB;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        orgA = createCompany("DF Org A " + System.nanoTime()).getId();
        orgB = createCompany("DF Org B " + System.nanoTime()).getId();

        user = new User();
        user.setEmail("dfo-user-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Multi Org User");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);

        fixtures.grantFullAccess(user.getId(), orgA);
        fixtures.grantFullAccess(user.getId(), orgB);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
    }

    private Company createCompany(String name) {
        Company c = new Company();
        c.setName(name);
        c.setBin(String.valueOf(100000000000L + Math.abs(name.hashCode()) % 899999999999L));
        c.setLegalAddress("г. Алматы");
        c.setPhone("+77000000000");
        c.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.save(c);
    }

    @Test
    void listOrganizations_returnsBothMembershipsOnly() throws Exception {
        mockMvc.perform(get("/api/document-flow/organizations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[?(@.organizationId == " + orgA + ")]").exists())
                .andExpect(jsonPath("$.data[?(@.organizationId == " + orgB + ")]").exists());
    }

    @Test
    void access_withoutOrganizationId_multiOrgUser_getsBenignNotAvailable() throws Exception {
        // Module spec: never silently pick a "first" membership - see OrganizationResolverTest.
        // The endpoint's own contract for the ambiguous case is a benign not-available response,
        // not an error; multi-org disambiguation is exactly what /organizations + ?organizationId
        // solves.
        mockMvc.perform(get("/api/document-flow/access"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(false));
    }

    @Test
    void access_withExplicitOrganizationId_resolvesThatOrganization() throws Exception {
        mockMvc.perform(get("/api/document-flow/access").param("organizationId", String.valueOf(orgA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.organizationId").value(orgA))
                .andExpect(jsonPath("$.data.organization.id").value(orgA))
                .andExpect(jsonPath("$.data.role").exists())
                .andExpect(jsonPath("$.data.membershipStatus").value("ACTIVE"));

        mockMvc.perform(get("/api/document-flow/access").param("organizationId", String.valueOf(orgB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.organizationId").value(orgB));
    }
}
