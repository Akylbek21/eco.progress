package kz.ecoprogress.documentflow.signing.api;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.version.DocumentVersion;
import kz.ecoprogress.documentflow.signing.AssignmentStatus;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import kz.ecoprogress.documentflow.signing.ForbiddenException;
import kz.ecoprogress.documentflow.signing.Sha256Util;
import kz.ecoprogress.documentflow.signing.SigningAssignmentRepository;
import kz.ecoprogress.documentflow.signing.SigningRoute;
import kz.ecoprogress.documentflow.signing.SigningRouteService;
import kz.ecoprogress.documentflow.signing.TestCmsSigner;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class PublicSigningServiceTest {

    @Autowired
    private PublicSigningService publicSigningService;
    @Autowired
    private DocumentFlowTestFixtures fixtures;
    @Autowired
    private SigningRouteService routeService;
    @Autowired
    private SigningAssignmentRepository assignmentRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private Long createUser() {
        User user = new User();
        user.setEmail("df-public-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Org Approver");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);
        fixtures.grantFullAccess(user.getId(), 1L);
        return user.getId();
    }

    @Test
    void expiredInvitationTokenIsRejected() {
        Long orgUser = createUser();
        Document document = fixtures.createDocument(1L);
        fixtures.createVersion(document, "content".getBytes(StandardCharsets.UTF_8));

        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("EXTERNAL", null, "External Signer",
                        null, "Counterparty LLP", "123456789012", "ext@example.com", null, "EXTERNAL", true)));
        var request = new SigningRouteDtos.CreateSigningRouteRequest("PARALLEL", List.of(step));
        SigningRoute route = routeService.createRoute(document.getId(), request, orgUser);
        routeService.prepareForSigning(document.getId(), null, orgUser);
        routeService.sendForSigning(document.getId(), orgUser);

        var assignment = assignmentRepository.findAllByStepIdIn(
                        routeService.stepsOf(route.getId()).stream().map(s -> s.getId()).toList())
                .get(0);
        // Force-expire it directly (simulates an old invitation past its deadline) rather than
        // waiting real time out - same code path resolveAssignment() uses either way.
        String rawToken = "test-raw-token-value";
        assignment.setInvitationTokenHash(Sha256Util.sha256Hex(rawToken));
        assignment.setInvitationExpiresAt(Instant.now().minusSeconds(3600));
        assignmentRepository.save(assignment);

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> publicSigningService.getInvitationView(rawToken));
        assertEquals("INVITATION_EXPIRED", ex.getCode());
    }

    @Test
    void validInvitationTokenAllowsExternalSignerToSignSuccessfully() throws Exception {
        Long orgUser = createUser();
        byte[] content = ("doc-" + System.nanoTime()).getBytes(StandardCharsets.UTF_8);
        Document document = fixtures.createDocument(1L);
        DocumentVersion version = fixtures.createVersion(document, content);

        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("EXTERNAL", null, "External Signer",
                        null, "Counterparty LLP", "123456789012", "ext@example.com", null, "EXTERNAL", true)));
        var request = new SigningRouteDtos.CreateSigningRouteRequest("PARALLEL", List.of(step));
        SigningRoute route = routeService.createRoute(document.getId(), request, orgUser);
        routeService.prepareForSigning(document.getId(), null, orgUser);
        routeService.sendForSigning(document.getId(), orgUser);

        var assignment = assignmentRepository.findAllByStepIdIn(
                        routeService.stepsOf(route.getId()).stream().map(s -> s.getId()).toList())
                .get(0);
        assertEquals(AssignmentStatus.AVAILABLE, assignment.getStatus());

        String rawToken = "test-raw-token-value-valid";
        assignment.setInvitationTokenHash(Sha256Util.sha256Hex(rawToken));
        assignment.setInvitationExpiresAt(Instant.now().plusSeconds(3600));
        assignmentRepository.save(assignment);

        // getInvitationView succeeds with a valid token.
        var view = publicSigningService.getInvitationView(rawToken);
        assertEquals(document.getId(), view.documentId());

        String cms = TestCmsSigner.signAttached(content);
        var signRequest = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), version.getId(),
                assignment.getId(), cms, "ext-req-1", null, null, null);
        var signature = publicSigningService.sign(rawToken, signRequest);
        assertEquals("VALID", signature.getVerificationStatus().name());
    }

    /** Module spec §13: the token-only path takes no documentId/versionId/assignmentId from the
     *  client at all - everything comes from the token, same as every other public endpoint. */
    @Test
    void signByToken_derivesEverythingFromToken_noClientSuppliedIds() throws Exception {
        Long orgUser = createUser();
        byte[] content = ("doc-token-only-" + System.nanoTime()).getBytes(StandardCharsets.UTF_8);
        Document document = fixtures.createDocument(1L);
        fixtures.createVersion(document, content);

        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("EXTERNAL", null, "External Signer",
                        null, "Counterparty LLP", "123456789012", "ext@example.com", null, "EXTERNAL", true)));
        var request = new SigningRouteDtos.CreateSigningRouteRequest("PARALLEL", List.of(step));
        SigningRoute route = routeService.createRoute(document.getId(), request, orgUser);
        routeService.prepareForSigning(document.getId(), null, orgUser);
        routeService.sendForSigning(document.getId(), orgUser);

        var assignment = assignmentRepository.findAllByStepIdIn(
                        routeService.stepsOf(route.getId()).stream().map(s -> s.getId()).toList())
                .get(0);
        String rawToken = "test-raw-token-value-tokenonly";
        assignment.setInvitationTokenHash(Sha256Util.sha256Hex(rawToken));
        assignment.setInvitationExpiresAt(Instant.now().plusSeconds(3600));
        assignmentRepository.save(assignment);

        var challenge = publicSigningService.getChallenge(rawToken);
        assertEquals(document.getTitle(), challenge.documentTitle());

        String cms = TestCmsSigner.signAttached(content);
        var signature = publicSigningService.signByToken(rawToken, cms, "token-only-req-1");
        assertEquals("VALID", signature.getVerificationStatus().name());
    }
}
