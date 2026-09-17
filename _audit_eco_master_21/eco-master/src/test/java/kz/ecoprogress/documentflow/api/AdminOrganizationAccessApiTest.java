package kz.ecoprogress.documentflow.api;

import kz.eco.EcoApplication;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc coverage of the new admin org-access endpoints added on top of the foundation-layer
 * fixes: paginated list (including orgs with no subscription), detail card, initialOwnerUserId on
 * the grant flow, admin member management (including the last-OWNER and IDOR guards), and
 * platform-role authorization (non-ADMIN must 403).
 */
@SpringBootTest(classes = EcoApplication.class)
@Transactional
class AdminOrganizationAccessApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;

    private MockMvc mockMvc;
    private User adminUser;

    private RequestPostProcessor asRole(User user, UserRole role) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        return authentication(auth);
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        adminUser = new User();
        adminUser.setEmail("admin-" + System.nanoTime() + "@ecoprogress.kz");
        adminUser.setPasswordHash(passwordEncoder.encode("demo123"));
        adminUser.setName("Admin");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setType(ClientType.staff);
        userRepository.save(adminUser);
    }

    private Company newCompany(String name) {
        Company company = new Company();
        company.setName(name);
        company.setBin("77" + System.nanoTime() % 10_000_000_000L);
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        return company;
    }

    @Test
    void list_isForbiddenForNonAdmin() throws Exception {
        User manager = new User();
        manager.setEmail("mgr-" + System.nanoTime() + "@ecoprogress.kz");
        manager.setPasswordHash(passwordEncoder.encode("demo123"));
        manager.setName("Manager");
        manager.setRole(UserRole.MANAGER);
        manager.setType(ClientType.staff);
        userRepository.save(manager);

        mockMvc.perform(get("/api/admin/document-flow/access").with(asRole(manager, UserRole.MANAGER)))
                .andExpect(status().isForbidden());
    }

    /** A document-flow OWNER (a MembershipRole, not a platform UserRole) must not bypass the
     *  admin-only gate just by being an OWNER of some organization - these are different concepts. */
    @Test
    void list_isForbiddenForDocumentFlowOwner_whoIsNotPlatformAdmin() throws Exception {
        Company company = newCompany("ТОО Owner Test");
        User owner = new User();
        owner.setEmail("owner-" + System.nanoTime() + "@ecoprogress.kz");
        owner.setPasswordHash(passwordEncoder.encode("demo123"));
        owner.setName("Owner");
        owner.setRole(UserRole.CLIENT);
        owner.setType(ClientType.individual);
        userRepository.save(owner);

        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(company.getId());
        membership.setUserId(owner.getId());
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setJoinedAt(LocalDateTime.now());
        membershipRepository.save(membership);

        mockMvc.perform(get("/api/admin/document-flow/access").with(asRole(owner, UserRole.CLIENT)))
                .andExpect(status().isForbidden());
    }

    @Test
    void list_includesOrganizationWithNoSubscription_andSupportsSearch() throws Exception {
        Company noSub = newCompany("ТОО Без Подписки Уникальное" + System.nanoTime());

        mockMvc.perform(get("/api/admin/document-flow/access")
                        .param("search", "Без Подписки Уникальное")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].organizationId").value(noSub.getId()))
                .andExpect(jsonPath("$.data.items[0].hasSubscription").value(false))
                .andExpect(jsonPath("$.data.items[0].availableAdminActions[0]").value("grant"));
    }

    @Test
    void detail_forOrganizationWithNoSubscription_returns200NotFoundShape() throws Exception {
        Company company = newCompany("ТОО Detail No Sub");

        mockMvc.perform(get("/api/admin/document-flow/access/" + company.getId())
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasSubscription").value(false))
                .andExpect(jsonPath("$.data.organizationId").value(company.getId()));
    }

    @Test
    void detail_forNonExistentOrganization_returns404() throws Exception {
        mockMvc.perform(get("/api/admin/document-flow/access/999999999")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void grant_withInitialOwnerUserId_createsActiveOwnerMembership() throws Exception {
        Company company = newCompany("ТОО Grant Owner");
        User futureOwner = new User();
        futureOwner.setEmail("future-owner-" + System.nanoTime() + "@ecoprogress.kz");
        futureOwner.setPasswordHash(passwordEncoder.encode("demo123"));
        futureOwner.setName("Future Owner");
        futureOwner.setRole(UserRole.CLIENT);
        futureOwner.setType(ClientType.individual);
        userRepository.save(futureOwner);

        String json = """
                {"organizationId": %d, "planCode": "BUSINESS", "startsAt": "2026-01-01T00:00:00",
                 "expiresAt": "2027-01-01T00:00:00", "paymentMode": "MANUAL_INVOICE", "reason": "grant with owner",
                 "initialOwnerUserId": %d}
                """.formatted(company.getId(), futureOwner.getId());

        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasOwner").value(true));

        DocumentFlowMembership membership = membershipRepository.findByOrganizationIdAndUserId(company.getId(), futureOwner.getId())
                .orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(MembershipRole.OWNER, membership.getRoleCode());
        org.junit.jupiter.api.Assertions.assertEquals(MembershipStatus.ACTIVE, membership.getStatus());
    }

    // --- Member management -------------------------------------------------------------------

    private Long grantAndGetOrgId(String companyName) throws Exception {
        Company company = newCompany(companyName);
        return company.getId();
    }

    @Test
    void memberManagement_createListActivateDeactivate_roundTrips() throws Exception {
        Long orgId = grantAndGetOrgId("ТОО Members RT");
        User member = new User();
        member.setEmail("member-" + System.nanoTime() + "@ecoprogress.kz");
        member.setPasswordHash(passwordEncoder.encode("demo123"));
        member.setName("Member");
        member.setRole(UserRole.CLIENT);
        member.setType(ClientType.individual);
        userRepository.save(member);

        String createJson = "{\"email\": \"" + member.getEmail() + "\", \"role\": \"VIEWER\"}";
        String response = mockMvc.perform(post("/api/admin/document-flow/access/organizations/" + orgId + "/members")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("VIEWER"))
                .andReturn().getResponse().getContentAsString();

        Long memberId = extractId(response);

        mockMvc.perform(get("/api/admin/document-flow/access/organizations/" + orgId + "/members")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].organizationId").value(orgId));

        mockMvc.perform(post("/api/admin/document-flow/access/organizations/" + orgId + "/members/" + memberId + "/deactivate")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUSPENDED"));

        mockMvc.perform(post("/api/admin/document-flow/access/organizations/" + orgId + "/members/" + memberId + "/activate")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void memberManagement_lastActiveOwner_cannotBeDeactivated() throws Exception {
        Long orgId = grantAndGetOrgId("ТОО Last Owner");
        User owner = new User();
        owner.setEmail("only-owner-" + System.nanoTime() + "@ecoprogress.kz");
        owner.setPasswordHash(passwordEncoder.encode("demo123"));
        owner.setName("Only Owner");
        owner.setRole(UserRole.CLIENT);
        owner.setType(ClientType.individual);
        userRepository.save(owner);

        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(orgId);
        membership.setUserId(owner.getId());
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setJoinedAt(LocalDateTime.now());
        membershipRepository.save(membership);

        mockMvc.perform(post("/api/admin/document-flow/access/organizations/" + orgId + "/members/" + membership.getId() + "/deactivate")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LAST_OWNER_CANNOT_BE_REMOVED"));
    }

    /** IDOR guard: a memberId that is real, but belongs to a DIFFERENT organization than the one
     *  in the path, must 404 - never act on it, never leak its existence via a different status. */
    @Test
    void memberManagement_memberIdFromAnotherOrganization_isRejectedAsNotFound() throws Exception {
        Long orgA = grantAndGetOrgId("ТОО Org A");
        Long orgB = grantAndGetOrgId("ТОО Org B");
        User user = new User();
        user.setEmail("cross-org-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Cross Org User");
        user.setRole(UserRole.CLIENT);
        user.setType(ClientType.individual);
        userRepository.save(user);

        DocumentFlowMembership membershipInOrgA = new DocumentFlowMembership();
        membershipInOrgA.setOrganizationId(orgA);
        membershipInOrgA.setUserId(user.getId());
        membershipInOrgA.setRoleCode(MembershipRole.VIEWER);
        membershipInOrgA.setStatus(MembershipStatus.ACTIVE);
        membershipInOrgA.setJoinedAt(LocalDateTime.now());
        membershipRepository.save(membershipInOrgA);

        // memberId belongs to orgA, but the request path names orgB.
        mockMvc.perform(post("/api/admin/document-flow/access/organizations/" + orgB + "/members/" + membershipInOrgA.getId() + "/deactivate")
                        .with(asRole(adminUser, UserRole.ADMIN)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEMBER_NOT_FOUND"));
    }

    private static Long extractId(String json) {
        Matcher m = Pattern.compile("\"id\":(\\d+)").matcher(json);
        if (m.find()) {
            return Long.valueOf(m.group(1));
        }
        throw new AssertionError("no id found in response: " + json);
    }
}
