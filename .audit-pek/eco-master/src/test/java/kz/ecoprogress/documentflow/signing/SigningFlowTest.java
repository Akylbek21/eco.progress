package kz.ecoprogress.documentflow.signing;

import kz.eco.common.exception.ConflictException;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentStatus;
import kz.ecoprogress.documentflow.version.DocumentVersion;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class SigningFlowTest {

    @Autowired
    private DocumentFlowTestFixtures fixtures;
    @Autowired
    private SigningRouteService routeService;
    @Autowired
    private SigningService signingService;
    @Autowired
    private SigningStepRepository stepRepository;
    @Autowired
    private SigningAssignmentRepository assignmentRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private kz.ecoprogress.documentflow.document.DocumentRepository documentRepository;

    private byte[] content;
    private Long orgId = 1L;

    @BeforeEach
    void setUp() {
        content = ("Test document body " + System.nanoTime()).getBytes(StandardCharsets.UTF_8);
    }

    private Long createUser() {
        User user = new User();
        user.setEmail("df-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Test Signer");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);
        fixtures.grantFullAccess(user.getId(), orgId);
        return user.getId();
    }

    private SigningRouteDtos.CreateSigningRouteRequest twoStepSequentialRequest(Long user1, Long user2) {
        var step1 = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", user1, "Signer One",
                        null, null, null, null, null, "EXECUTOR", true)));
        var step2 = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", user2, "Signer Two",
                        null, null, null, null, null, "APPROVER", true)));
        return new SigningRouteDtos.CreateSigningRouteRequest("SEQUENTIAL", List.of(step1, step2));
    }

    private Document setupDocumentAndVersion() {
        Document document = fixtures.createDocument(orgId);
        DocumentVersion version = fixtures.createVersion(document, content);
        return document;
    }

    private void prepareAndSend(Long documentId, Long userId) {
        routeService.prepareForSigning(documentId, null, userId);
        routeService.sendForSigning(documentId, userId);
    }

    @Test
    void sequentialRoute_step2CannotSignBeforeStep1Completes() throws Exception {
        Long user1 = createUser();
        Long user2 = createUser();
        Document document = setupDocumentAndVersion();
        SigningRoute route = routeService.createRoute(document.getId(), twoStepSequentialRequest(user1, user2), user1);
        prepareAndSend(document.getId(), user1);

        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        SigningAssignment step1Assignment = assignmentRepository.findAllByStepId(steps.get(0).getId()).get(0);
        SigningAssignment step2Assignment = assignmentRepository.findAllByStepId(steps.get(1).getId()).get(0);

        // Step 1 became AVAILABLE on send-for-signing, step 2 did not.
        assertEquals(AssignmentStatus.AVAILABLE, refresh(step1Assignment).getStatus());
        assertEquals(AssignmentStatus.PENDING, refresh(step2Assignment).getStatus());

        // Attempting to sign step 2's assignment before step 1 is done must fail.
        Long versionId = document.getCurrentVersionId();
        String cmsForStep2 = TestCmsSigner.signAttached(content);
        var step2Request = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), versionId,
                step2Assignment.getId(), cmsForStep2, "req-step2-early", null, null, null);
        ConflictException ex = assertThrows(ConflictException.class,
                () -> signingService.submitOrganizationMemberSignature(step2Request, user2));
        assertEquals("ASSIGNMENT_NOT_AVAILABLE", ex.getCode());

        // Now sign step 1 for real - this should activate step 2.
        String cmsForStep1 = TestCmsSigner.signAttached(content);
        var step1Request = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), versionId,
                step1Assignment.getId(), cmsForStep1, "req-step1", null, null, null);
        signingService.submitOrganizationMemberSignature(step1Request, user1);

        assertEquals(AssignmentStatus.SIGNED, refresh(step1Assignment).getStatus());
        assertEquals(AssignmentStatus.AVAILABLE, refresh(step2Assignment).getStatus());

        // Step 2 can now sign successfully.
        var step2RequestNow = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), versionId,
                step2Assignment.getId(), cmsForStep2, "req-step2", null, null, null);
        signingService.submitOrganizationMemberSignature(step2RequestNow, user2);
        assertEquals(AssignmentStatus.SIGNED, refresh(step2Assignment).getStatus());

        // Route/document complete now that both required steps are signed.
        Document reloaded = documentRepository.findById(document.getId()).orElseThrow();
        assertEquals(DocumentStatus.SIGNED, reloaded.getStatus());
    }

    @Test
    void parallelRoute_allAssignmentsImmediatelyAvailable() {
        Long user1 = createUser();
        Long user2 = createUser();
        Document document = setupDocumentAndVersion();
        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", user1, "Signer One",
                        null, null, null, null, null, "EXECUTOR", true),
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", user2, "Signer Two",
                        null, null, null, null, null, "APPROVER", true)));
        var request = new SigningRouteDtos.CreateSigningRouteRequest("PARALLEL", List.of(step));
        SigningRoute route = routeService.createRoute(document.getId(), request, user1);
        prepareAndSend(document.getId(), user1);

        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        List<SigningAssignment> assignments = assignmentRepository.findAllByStepId(steps.get(0).getId());
        assertTrue(assignments.stream().allMatch(a -> refresh(a).getStatus() == AssignmentStatus.AVAILABLE));
    }

    @Test
    void sameUserCannotSignSameAssignmentTwice_cleanConflictNotServerError() throws Exception {
        Long user1 = createUser();
        Long user2 = createUser();
        Document document = setupDocumentAndVersion();
        SigningRoute route = routeService.createRoute(document.getId(), twoStepSequentialRequest(user1, user2), user1);
        prepareAndSend(document.getId(), user1);

        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        SigningAssignment step1Assignment = assignmentRepository.findAllByStepId(steps.get(0).getId()).get(0);
        Long versionId = document.getCurrentVersionId();
        String cms = TestCmsSigner.signAttached(content);

        var firstRequest = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), versionId,
                step1Assignment.getId(), cms, "req-first", null, null, null);
        signingService.submitOrganizationMemberSignature(firstRequest, user1);

        // Genuine double-call: same assignment, second attempt must be a clean 409, never a 500.
        var secondRequest = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), versionId,
                step1Assignment.getId(), cms, "req-second", null, null, null);
        ConflictException ex = assertThrows(ConflictException.class,
                () -> signingService.submitOrganizationMemberSignature(secondRequest, user1));
        assertEquals("SIGNATURE_ALREADY_EXISTS", ex.getCode());
    }

    @Test
    void privateKeyMaterialInRequestIsExplicitlyRejected() throws Exception {
        Long user1 = createUser();
        Long user2 = createUser();
        Document document = setupDocumentAndVersion();
        SigningRoute route = routeService.createRoute(document.getId(), twoStepSequentialRequest(user1, user2), user1);
        prepareAndSend(document.getId(), user1);
        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        SigningAssignment step1Assignment = assignmentRepository.findAllByStepId(steps.get(0).getId()).get(0);
        String cms = TestCmsSigner.signAttached(content);

        var requestWithPassword = new SigningRouteDtos.SubmitSignatureRequest(document.getId(), document.getCurrentVersionId(),
                step1Assignment.getId(), cms, "req-pk", null, "hunter2", null);
        assertThrows(kz.eco.common.exception.BadRequestException.class,
                () -> signingService.submitOrganizationMemberSignature(requestWithPassword, user1));
    }

    private SigningAssignment refresh(SigningAssignment assignment) {
        return assignmentRepository.findById(assignment.getId()).orElseThrow();
    }
}
