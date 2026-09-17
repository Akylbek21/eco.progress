package kz.ecoprogress.documentflow.membership;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end coverage for the internal-mode simplification: a system ADMIN opens document-flow
 * with zero manual subscription/membership setup, grants a colleague access by email, changes
 * their role, and deactivates them - all through the real HTTP endpoints, not internal service
 * calls, so the whole request pipeline (security, OrganizationResolver, permission checks,
 * GlobalExceptionHandler) is exercised exactly as a real client would hit it.
 */
@SpringBootTest(classes = EcoApplication.class)
@Transactional
class DocumentFlowMemberApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;
    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private kz.ecoprogress.documentflow.access.DocumentFlowAccessService accessService;
    @Autowired private DocumentFlowMemberService memberService;

    private MockMvc mockMvc;
    private Long ecoProgressId;
    private User admin;
    private User colleague;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company ecoProgress = companyRepository.findByName("EcoProgress").orElseGet(() -> {
            Company c = new Company();
            c.setName("EcoProgress");
            c.setBin("000000000001");
            c.setLegalAddress("г. Алматы");
            c.setPhone("+77000000000");
            c.setStatus(CompanyStatus.ACTIVE);
            return companyRepository.save(c);
        });
        ecoProgressId = ecoProgress.getId();

        // A throwaway pre-existing owner just to get an ACTIVE subscription onto the organization
        // (grantFullAccess creates both a membership and a subscription; only the subscription is
        // wanted here - the ADMIN's own membership is exactly what auto-provisioning is supposed
        // to create, not something the test should pre-seed).
        User bootstrapOwner = new User();
        bootstrapOwner.setEmail("bootstrap-owner-" + System.nanoTime() + "@ecoprogress.kz");
        bootstrapOwner.setPasswordHash(passwordEncoder.encode("demo123"));
        bootstrapOwner.setName("Bootstrap Owner");
        bootstrapOwner.setRole(UserRole.MANAGER);
        bootstrapOwner.setType(ClientType.staff);
        userRepository.save(bootstrapOwner);
        fixtures.grantFullAccess(bootstrapOwner.getId(), ecoProgressId);

        admin = new User();
        admin.setEmail("dfm-admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("System Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);

        colleague = new User();
        colleague.setEmail("dfm-colleague-" + System.nanoTime() + "@ecoprogress.kz");
        colleague.setPasswordHash(passwordEncoder.encode("demo123"));
        colleague.setName("Иванов Иван");
        colleague.setRole(UserRole.MANAGER);
        colleague.setType(ClientType.staff);
        userRepository.save(colleague);

        authenticateAs(admin);
    }

    private void authenticateAs(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
    }

    @Test
    void adminWithNoMembership_opensAccessEndpoint_withoutManualSubscriptionSetup() throws Exception {
        mockMvc.perform(get("/api/document-flow/access"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.internalMode").value(true))
                .andExpect(jsonPath("$.data.organization.name").value("EcoProgress"))
                .andExpect(jsonPath("$.data.permissions").isArray());

        assertEquals(MembershipRole.OWNER,
                membershipRepository.findByOrganizationIdAndUserId(ecoProgressId, admin.getId()).orElseThrow().getRoleCode());
    }

    @Test
    void adminGrantsAccessByEmail_colleagueGetsActiveMembership() throws Exception {
        String json = """
                {"email": "%s", "role": "DOCUMENT_MANAGER"}
                """.formatted(colleague.getEmail());
        MvcResult result = mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("DOCUMENT_MANAGER"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();
        Long memberId = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());

        Optional<DocumentFlowMembership> membership = membershipRepository.findByOrganizationIdAndUserId(ecoProgressId, colleague.getId());
        assertEquals(MembershipRole.DOCUMENT_MANAGER, membership.orElseThrow().getRoleCode());
        assertEquals(MembershipStatus.ACTIVE, membership.get().getStatus());
        assertEquals(memberId, membership.get().getId());
    }

    @Test
    void grantingAccessTwice_updatesRole_doesNotCreateDuplicateMembership() throws Exception {
        String createJson = """
                {"email": "%s", "role": "VIEWER"}
                """.formatted(colleague.getEmail());
        mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson))
                .andExpect(status().isOk());

        String changeRoleJson = """
                {"email": "%s", "role": "SIGNER"}
                """.formatted(colleague.getEmail());
        mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(changeRoleJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("SIGNER"));

        List<DocumentFlowMembership> all = membershipRepository.findByOrganizationIdAndStatusNot(ecoProgressId, MembershipStatus.REMOVED);
        long colleagueRows = all.stream().filter(m -> m.getUserId().equals(colleague.getId())).count();
        assertEquals(1, colleagueRows, "must update the existing row, not create a second membership");
    }

    @Test
    void grantingAccessToUnknownEmail_returnsMemberNotFound() throws Exception {
        String json = """
                {"email": "nobody-registered@ecoprogress.kz", "role": "VIEWER"}
                """;
        mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    @Test
    void invalidRole_isRejected() throws Exception {
        String json = """
                {"email": "%s", "role": "SUPER_HACKER"}
                """.formatted(colleague.getEmail());
        mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MEMBER_ROLE_INVALID"));
    }

    @Test
    void deactivatedMember_losesAccess() throws Exception {
        String createJson = """
                {"email": "%s", "role": "DOCUMENT_MANAGER"}
                """.formatted(colleague.getEmail());
        MvcResult created = mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(createJson))
                .andExpect(status().isOk())
                .andReturn();
        Long memberId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(post("/api/document-flow/members/" + memberId + "/deactivate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUSPENDED"));

        // Verified via the service directly, not a second MockMvc call under a switched
        // SecurityContextHolder identity: MockMvc's real security filter chain does not reliably
        // pick up a mid-test-method authenticateAs() swap for a *subsequent* .perform() call (the
        // same pitfall documented in ProtocolSigningApiTest) - the service call exercises the
        // exact same production logic (AccessContext.canOpenModule()) without that flakiness.
        assertEquals(false, accessService.getAccessContext(colleague.getId(), ecoProgressId).canOpenModule(),
                "a SUSPENDED membership must not be able to open the module");
    }

    @Test
    void nonOwnerCannotManageMembers() throws Exception {
        String grantViewer = """
                {"email": "%s", "role": "VIEWER"}
                """.formatted(colleague.getEmail());
        mockMvc.perform(post("/api/document-flow/members")
                        .contentType(MediaType.APPLICATION_JSON).content(grantViewer))
                .andExpect(status().isOk());

        // Same rationale as deactivatedMember_losesAccess above - exercise the service directly
        // for the switched-identity assertion instead of a second MockMvc call.
        kz.ecoprogress.documentflow.signing.ForbiddenException ex = org.junit.jupiter.api.Assertions.assertThrows(
                kz.ecoprogress.documentflow.signing.ForbiddenException.class,
                () -> memberService.create(colleague.getId(), ecoProgressId, admin.getEmail(), "VIEWER"));
        assertEquals("MEMBER_MANAGE_FORBIDDEN", ex.getCode());
    }
}
