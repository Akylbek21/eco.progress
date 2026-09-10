package kz.ecoprogress.documentflow.api;

import kz.eco.EcoApplication;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowReadOnlyException;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.subscription.DocumentFlowSubscriptionExpirationJob;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full Spring context / MockMvc coverage of the document-flow foundation layer: admin access-grant
 * end to end, the "at most one non-terminal subscription" invariant, suspend/restore, the
 * expiration job flipping a past-dated subscription, and tenant isolation.
 */
@SpringBootTest(classes = EcoApplication.class)
@Transactional
class DocumentFlowModuleApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;
    @Autowired private OrganizationSubscriptionRepository subscriptionRepository;
    @Autowired private SubscriptionPlanRepository planRepository;
    @Autowired private DocumentFlowAccessService accessService;
    @Autowired private DocumentFlowSubscriptionExpirationJob expirationJob;

    private MockMvc mockMvc;
    private Long companyId;
    private User adminUser;
    private User ownerUser;

    private RequestPostProcessor asRole(User user, UserRole role) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        return authentication(auth);
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Document Flow Test");
        company.setBin("99" + System.nanoTime() % 10_000_000_000L);
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        adminUser = new User();
        adminUser.setEmail("df-admin-" + System.nanoTime() + "@ecoprogress.kz");
        adminUser.setPasswordHash(passwordEncoder.encode("demo123"));
        adminUser.setName("DF Admin");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setType(ClientType.staff);
        userRepository.save(adminUser);

        ownerUser = new User();
        ownerUser.setEmail("df-owner-" + System.nanoTime() + "@ecoprogress.kz");
        ownerUser.setPasswordHash(passwordEncoder.encode("demo123"));
        ownerUser.setName("DF Owner");
        ownerUser.setRole(UserRole.CLIENT);
        ownerUser.setType(ClientType.individual);
        userRepository.save(ownerUser);

        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(companyId);
        membership.setUserId(ownerUser.getId());
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setJoinedAt(LocalDateTime.now());
        membershipRepository.save(membership);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(adminUser, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    private String grantJson(String planCode, String startsAt, String expiresAt) {
        return """
                {"organizationId": %d, "planCode": "%s", "startsAt": "%s", "expiresAt": %s,
                 "paymentMode": "MANUAL_INVOICE", "reason": "test grant"}
                """.formatted(companyId, planCode, startsAt, expiresAt == null ? "null" : "\"" + expiresAt + "\"");
    }

    @Test
    void accessGrant_createsActiveSubscription_andAccessEndpointReflectsIt() throws Exception {
        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("BUSINESS", "2026-01-01T00:00:00", "2027-01-01T00:00:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.subscriptionStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.data.planCode").value("BUSINESS"));

        mockMvc.perform(get("/api/document-flow/access").with(asRole(ownerUser, UserRole.CLIENT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(true))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.plan.code").value("BUSINESS"));
    }

    @Test
    void secondAccessGrant_updatesInPlace_doesNotLeaveTwoActiveSubscriptions() throws Exception {
        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("START", "2026-01-01T00:00:00", "2027-01-01T00:00:00")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("BUSINESS", "2026-02-01T00:00:00", "2027-02-01T00:00:00")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planCode").value("BUSINESS"));

        List<OrganizationSubscription> nonTerminal = subscriptionRepository.findByOrganizationIdAndStatusIn(
                companyId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
        assertEquals(1, nonTerminal.size(), "must never have two non-terminal subscriptions for the same organization");
        String planCode = planRepository.findById(nonTerminal.get(0).getPlanId()).orElseThrow().getCode();
        assertEquals("BUSINESS", planCode);
    }

    @Test
    void suspendThenRestore_roundTrips() throws Exception {
        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("BUSINESS", "2026-01-01T00:00:00", "2027-01-01T00:00:00")))
                .andExpect(status().isOk());

        Long versionAfterGrant = subscriptionRepository.findByOrganizationId(companyId).stream()
                .findFirst().orElseThrow().getVersion();

        mockMvc.perform(post("/api/admin/document-flow/subscriptions/" + companyId + "/suspend")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"нарушение условий\", \"expectedVersion\": " + versionAfterGrant + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.subscriptionStatus").value("SUSPENDED"));

        mockMvc.perform(get("/api/document-flow/access").with(asRole(ownerUser, UserRole.CLIENT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.data.available").value(false));

        Long versionAfterSuspend = subscriptionRepository.findByOrganizationId(companyId).stream()
                .findFirst().orElseThrow().getVersion();

        mockMvc.perform(post("/api/admin/document-flow/subscriptions/" + companyId + "/restore")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"условия выполнены\", \"expectedVersion\": " + versionAfterSuspend + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.subscriptionStatus").value("ACTIVE"));
    }

    @Test
    void suspend_withStaleExpectedVersion_returnsVersionConflict() throws Exception {
        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("BUSINESS", "2026-01-01T00:00:00", "2027-01-01T00:00:00")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/admin/document-flow/subscriptions/" + companyId + "/suspend")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"нарушение условий\", \"expectedVersion\": 9999}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void expirationJob_flipsPastDatedActiveSubscription_toExpired_andBlocksWrites() throws Exception {
        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("BUSINESS", "2020-01-01T00:00:00", "2020-02-01T00:00:00")))
                .andExpect(status().isOk());

        expirationJob.run();

        OrganizationSubscription updated = subscriptionRepository.findByOrganizationId(companyId).stream()
                .filter(s -> s.getStatus() == SubscriptionStatus.EXPIRED)
                .findFirst()
                .orElseThrow(() -> new AssertionError("expected an EXPIRED subscription after running the job"));
        assertEquals(SubscriptionStatus.EXPIRED, updated.getStatus());

        assertThrows(DocumentFlowReadOnlyException.class,
                () -> accessService.requireWriteAccess(ownerUser.getId(), companyId));
        // Read access must still be allowed even though the subscription is expired.
        assertDoesNotThrow(() -> accessService.requireActiveAccess(ownerUser.getId(), companyId));
    }

    @Test
    void accessGrant_idempotencyReplay_sameKeyAndBody_doesNotDoubleGrant() throws Exception {
        String json = grantJson("BUSINESS", "2026-01-01T00:00:00", "2027-01-01T00:00:00");

        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .header("Idempotency-Key", "idem-key-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .header("Idempotency-Key", "idem-key-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("idempotent replay")));

        List<OrganizationSubscription> nonTerminal = subscriptionRepository.findByOrganizationIdAndStatusIn(
                companyId, List.copyOf(SubscriptionStatus.nonTerminalStatuses()));
        assertEquals(1, nonTerminal.size(), "a replayed idempotent grant must not create a second subscription");
    }

    @Test
    void accessGrant_idempotencyKeyReused_withDifferentBody_isRejected() throws Exception {
        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .header("Idempotency-Key", "idem-key-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("BUSINESS", "2026-01-01T00:00:00", "2027-01-01T00:00:00")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/admin/document-flow/access-grants")
                        .with(asRole(adminUser, UserRole.ADMIN))
                        .header("Idempotency-Key", "idem-key-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(grantJson("START", "2026-03-01T00:00:00", "2027-03-01T00:00:00")))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void userWithNoMembership_getsNoAccess_viaAccessEndpoint() throws Exception {
        User stranger = new User();
        stranger.setEmail("df-stranger-" + System.nanoTime() + "@ecoprogress.kz");
        stranger.setPasswordHash(passwordEncoder.encode("demo123"));
        stranger.setName("Stranger");
        stranger.setRole(UserRole.CLIENT);
        stranger.setType(ClientType.individual);
        userRepository.save(stranger);

        mockMvc.perform(get("/api/document-flow/access").with(asRole(stranger, UserRole.CLIENT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(false));

        assertThrows(Exception.class, () -> accessService.requireWriteAccess(stranger.getId(), companyId));
    }
}
