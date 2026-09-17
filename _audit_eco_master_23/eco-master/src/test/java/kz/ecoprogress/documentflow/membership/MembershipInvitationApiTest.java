package kz.ecoprogress.documentflow.membership;

import com.jayway.jsonpath.JsonPath;
import kz.eco.EcoApplication;
import kz.eco.audit.AuditLogRepository;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.mail.EmailOutboxRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import kz.ecoprogress.documentflow.signing.Sha256Util;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = EcoApplication.class)
@Transactional
class MembershipInvitationApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;
    @Autowired private MembershipInvitationRepository invitationRepository;
    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;

    private MockMvc mockMvc;
    private Long organizationId;
    private User owner;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company org = new Company();
        org.setName("Invite Test Org " + System.nanoTime());
        org.setBin("123456789012");
        org.setLegalAddress("г. Алматы");
        org.setPhone("+77000000001");
        org.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(org);
        organizationId = org.getId();

        owner = new User();
        owner.setEmail("invite-owner-" + System.nanoTime() + "@ecoprogress.kz");
        owner.setPasswordHash(passwordEncoder.encode("demo123"));
        owner.setName("Owner");
        owner.setRole(UserRole.MANAGER);
        owner.setType(ClientType.staff);
        userRepository.save(owner);
        fixtures.grantFullAccess(owner.getId(), organizationId);

        authenticateAs(owner);
    }

    private void authenticateAs(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
    }

    @Test
    void invite_newEmail_createsInvitedMembershipAndSendsEmail() throws Exception {
        String email = "invitee-" + System.nanoTime() + "@ecoprogress.kz";
        mockMvc.perform(post("/api/document-flow/members/invite")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        User created = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        DocumentFlowMembership membership = membershipRepository
                .findByOrganizationIdAndUserId(organizationId, created.getId()).orElseThrow();
        assertEquals(MembershipStatus.INVITED, membership.getStatus());
        assertEquals(MembershipRole.VIEWER, membership.getRoleCode());
        assertTrue(emailOutboxRepository.findByToEmailIgnoreCaseOrderByCreatedAtDesc(email).size() >= 1);
    }

    @Test
    void invite_thenAccept_activatesMembership() throws Exception {
        String email = "accept-" + System.nanoTime() + "@ecoprogress.kz";
        mockMvc.perform(post("/api/document-flow/members/invite")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"SIGNER\"}"))
                .andExpect(status().isOk());

        User invitee = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        MembershipInvitation invitation = invitationRepository
                .findFirstByOrganizationIdAndUserIdAndStatusOrderByCreatedAtDesc(
                        organizationId, invitee.getId(), MembershipInvitationStatus.INVITED)
                .orElseThrow();
        String rawToken = findRawTokenForHash(invitation.getTokenHash());

        mockMvc.perform(post("/api/public/document-flow/invitations/" + rawToken + "/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"newPassword1\"}"))
                .andExpect(status().isOk());

        DocumentFlowMembership membership = membershipRepository
                .findByOrganizationIdAndUserId(organizationId, invitee.getId()).orElseThrow();
        assertEquals(MembershipStatus.ACTIVE, membership.getStatus());
    }

    @Test
    void invite_alreadyActiveMember_returns409() throws Exception {
        String email = "active-" + System.nanoTime() + "@ecoprogress.kz";
        User existing = new User();
        existing.setEmail(email);
        existing.setPasswordHash(passwordEncoder.encode("demo123"));
        existing.setName("Existing");
        existing.setRole(UserRole.MANAGER);
        existing.setType(ClientType.staff);
        userRepository.save(existing);
        fixtures.grantFullAccess(existing.getId(), organizationId);

        mockMvc.perform(post("/api/document-flow/members/invite")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void resendInvite_issuesNewToken() throws Exception {
        String email = "resend-" + System.nanoTime() + "@ecoprogress.kz";
        MvcResult inviteResult = mockMvc.perform(post("/api/document-flow/members/invite")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk())
                .andReturn();

        User invitee = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        Long memberId = membershipRepository.findByOrganizationIdAndUserId(organizationId, invitee.getId())
                .orElseThrow().getId();

        mockMvc.perform(post("/api/document-flow/members/" + memberId + "/resend-invite")
                        .param("organizationId", organizationId.toString()))
                .andExpect(status().isOk());

        long invitedCount = invitationRepository.findAll().stream()
                .filter(inv -> inv.getUserId().equals(invitee.getId()) && inv.getStatus() == MembershipInvitationStatus.INVITED)
                .count();
        assertEquals(1, invitedCount, "exactly one still-active invitation after resend (old one revoked)");
        long totalCount = invitationRepository.findAll().stream()
                .filter(inv -> inv.getUserId().equals(invitee.getId()))
                .count();
        assertEquals(2, totalCount, "original invitation kept (revoked) plus a new one issued");
    }

    @Test
    void decline_marksInvitationDeclined() throws Exception {
        String email = "decline-" + System.nanoTime() + "@ecoprogress.kz";
        mockMvc.perform(post("/api/document-flow/members/invite")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk());

        User invitee = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        MembershipInvitation invitation = invitationRepository
                .findFirstByOrganizationIdAndUserIdAndStatusOrderByCreatedAtDesc(
                        organizationId, invitee.getId(), MembershipInvitationStatus.INVITED)
                .orElseThrow();
        String rawToken = findRawTokenForHash(invitation.getTokenHash());

        mockMvc.perform(post("/api/public/document-flow/invitations/" + rawToken + "/decline"))
                .andExpect(status().isOk());

        MembershipInvitation reloaded = invitationRepository.findById(invitation.getId()).orElseThrow();
        assertEquals(MembershipInvitationStatus.DECLINED, reloaded.getStatus());
    }

    @Test
    void remove_setsRemovedStatus() throws Exception {
        String email = "remove-" + System.nanoTime() + "@ecoprogress.kz";
        User target = new User();
        target.setEmail(email);
        target.setPasswordHash(passwordEncoder.encode("demo123"));
        target.setName("Target");
        target.setRole(UserRole.MANAGER);
        target.setType(ClientType.staff);
        userRepository.save(target);

        MvcResult created = mockMvc.perform(post("/api/document-flow/members")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Long memberId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(delete("/api/document-flow/members/" + memberId)
                        .param("organizationId", organizationId.toString()))
                .andExpect(status().isOk());

        DocumentFlowMembership membership = membershipRepository.findById(memberId).orElseThrow();
        assertEquals(MembershipStatus.REMOVED, membership.getStatus());
    }

    @Test
    void auditLog_returnsRecordedEntries() throws Exception {
        String email = "audit-" + System.nanoTime() + "@ecoprogress.kz";
        User target = new User();
        target.setEmail(email);
        target.setPasswordHash(passwordEncoder.encode("demo123"));
        target.setName("Audit Target");
        target.setRole(UserRole.MANAGER);
        target.setType(ClientType.staff);
        userRepository.save(target);

        MvcResult created = mockMvc.perform(post("/api/document-flow/members")
                        .param("organizationId", organizationId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Long memberId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(get("/api/document-flow/members/" + memberId + "/audit-log")
                        .param("organizationId", organizationId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].actionType").exists());
    }

    /** Test-only shortcut: the raw token is only ever available at creation time via
     *  MembershipInvitationService.Created and normally goes out over email - since we can't read
     *  the outbox body reliably across implementations, brute-check isn't needed because we control
     *  creation; here we instead regenerate by scanning outbox body for the token appended after
     *  "accept" (matches DocumentFlowMemberService#sendInvitationEmail's link format). */
    private String findRawTokenForHash(String tokenHash) {
        List<kz.eco.mail.EmailOutbox> rows = emailOutboxRepository.findAll();
        for (kz.eco.mail.EmailOutbox row : rows) {
            String body = row.getBody();
            int idx = body.indexOf("/invitations/");
            if (idx < 0) continue;
            String rest = body.substring(idx + "/invitations/".length());
            int end = rest.indexOf('/');
            String candidate = end >= 0 ? rest.substring(0, end) : rest;
            if (Sha256Util.sha256Hex(candidate).equals(tokenHash)) {
                return candidate;
            }
        }
        throw new IllegalStateException("raw token not found in outbox for hash " + tokenHash);
    }
}
