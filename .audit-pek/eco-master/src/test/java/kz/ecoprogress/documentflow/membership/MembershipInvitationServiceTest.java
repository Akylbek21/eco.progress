package kz.ecoprogress.documentflow.membership;

import kz.eco.EcoApplication;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = EcoApplication.class)
@Transactional
class MembershipInvitationServiceTest {
    @Autowired MembershipInvitationService service;
    @Autowired MembershipInvitationRepository invitations;
    @Autowired DocumentFlowMembershipRepository memberships;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void invitationActivatesMembershipAndCanBeUsedOnlyOnce() {
        User user = new User();
        user.setEmail("invited-" + System.nanoTime() + "@example.kz");
        user.setName("Invited owner");
        user.setPasswordHash(passwordEncoder.encode("unknown-before-invite"));
        user.setRole(UserRole.CLIENT);
        user.setType(ClientType.company);
        user = users.save(user);

        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setOrganizationId(9_000_000L + System.nanoTime() % 100_000L);
        membership.setUserId(user.getId());
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.INVITED);
        membership = memberships.save(membership);

        MembershipInvitationService.Created created = service.create(membership, user, null);
        assertNotEquals(created.rawToken(), created.invitation().getTokenHash(), "raw token must never be persisted");

        assertEquals(membership.getId(), service.accept(created.rawToken(), "new-secure-password"));
        assertEquals(MembershipStatus.ACTIVE, memberships.findById(membership.getId()).orElseThrow().getStatus());
        assertEquals(MembershipInvitationStatus.ACCEPTED,
                invitations.findById(created.invitation().getId()).orElseThrow().getStatus());
        assertTrue(passwordEncoder.matches("new-secure-password", users.findById(user.getId()).orElseThrow().getPasswordHash()));

        assertThrows(RuntimeException.class, () -> service.accept(created.rawToken(), "another-password"));
    }
}
