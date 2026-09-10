package kz.ecoprogress.documentflow.signing;

import kz.eco.mail.EmailOutbox;
import kz.eco.mail.EmailOutboxRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Module spec §21: external invitations must actually be queued for delivery (real SMTP outbox),
 *  not just logged. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class ExternalInvitationEmailTest {

    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private SigningRouteService routeService;
    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void sendingRoute_withExternalAssignment_queuesInvitationEmail() {
        User orgUser = new User();
        orgUser.setEmail("df-email-test-" + System.nanoTime() + "@ecoprogress.kz");
        orgUser.setPasswordHash(passwordEncoder.encode("demo123"));
        orgUser.setName("Sender");
        orgUser.setRole(UserRole.MANAGER);
        orgUser.setType(ClientType.staff);
        userRepository.save(orgUser);
        fixtures.grantFullAccess(orgUser.getId(), 1L);

        Document document = fixtures.createDocument(1L);
        fixtures.createVersion(document, "content".getBytes());

        String recipientEmail = "external-signer-" + System.nanoTime() + "@example.com";
        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("EXTERNAL", null, "External Signer",
                        null, "Counterparty LLP", "123456789012", recipientEmail, null, "EXTERNAL", true)));
        routeService.createRoute(document.getId(),
                new SigningRouteDtos.CreateSigningRouteRequest("PARALLEL", List.of(step)), orgUser.getId());
        routeService.prepareForSigning(document.getId(), null, orgUser.getId());
        routeService.sendForSigning(document.getId(), orgUser.getId());

        List<EmailOutbox> queued = emailOutboxRepository.findAll();
        assertTrue(queued.stream().anyMatch(e -> recipientEmail.equalsIgnoreCase(e.getToEmail())),
                "external invitation must be queued in the real email outbox, not just logged");
    }
}
