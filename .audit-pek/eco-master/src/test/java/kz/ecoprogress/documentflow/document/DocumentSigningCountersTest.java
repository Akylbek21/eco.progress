package kz.ecoprogress.documentflow.document;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.signing.AssignmentStatus;
import kz.ecoprogress.documentflow.signing.DocumentFlowTestFixtures;
import kz.ecoprogress.documentflow.signing.SigningAssignment;
import kz.ecoprogress.documentflow.signing.SigningAssignmentRepository;
import kz.ecoprogress.documentflow.signing.SigningRoute;
import kz.ecoprogress.documentflow.signing.SigningRouteService;
import kz.ecoprogress.documentflow.signing.SigningStep;
import kz.ecoprogress.documentflow.signing.SigningStepRepository;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Module spec §7/§8: signedCount/requiredCount/requiresMySignature must come from real
 * document_flow_signing_assignments rows, and requiresMySignature=true must filter the page down
 * to only documents the current user actually has a live assignment on (never an arbitrary
 * client-supplied signerId).
 */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class DocumentSigningCountersTest {

    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private DocumentService documentService;
    @Autowired private SigningRouteService routeService;
    @Autowired private SigningStepRepository stepRepository;
    @Autowired private SigningAssignmentRepository assignmentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository membershipRepository;

    private Long orgId = 1L;
    private Long ownerId;

    @BeforeEach
    void setUp() {
        ownerId = createUser();
        fixtures.grantFullAccess(ownerId, orgId);
    }

    private Long createUser() {
        User user = new User();
        user.setEmail("df-counters-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Counters Test User");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);
        return user.getId();
    }

    private Long createSignerMember() {
        Long userId = createUser();
        var m = new kz.ecoprogress.documentflow.membership.DocumentFlowMembership();
        m.setUserId(userId);
        m.setOrganizationId(orgId);
        m.setRoleCode(MembershipRole.SIGNER);
        m.setStatus(MembershipStatus.ACTIVE);
        membershipRepository.save(m);
        return userId;
    }

    @Test
    void signedAssignment_isCountedAndOptionalAssignmentIsNotRequired() throws Exception {
        Long signer1 = createSignerMember();
        Long signer2 = createSignerMember();
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());

        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", signer1, "Required Signer",
                        null, null, null, null, null, "EXECUTOR", true),
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", signer2, "Optional Signer",
                        null, null, null, null, null, "OBSERVER", false)));
        SigningRoute route = routeService.createRoute(document.getId(),
                new SigningRouteDtos.CreateSigningRouteRequest("PARALLEL", List.of(step)), ownerId);
        routeService.prepareForSigning(document.getId(), null, ownerId);
        routeService.sendForSigning(document.getId(), ownerId);

        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        SigningAssignment required = assignmentRepository.findAllByStepId(steps.get(0).getId()).stream()
                .filter(a -> a.getUserId().equals(signer1)).findFirst().orElseThrow();
        required.setStatus(AssignmentStatus.SIGNED);
        assignmentRepository.save(required);

        DocumentDtos.DocumentListItemDto dto = documentService.toListItemDto(
                documentService.get(document.getId(), orgId), ownerId, orgId);

        assertEquals(1, dto.signedCount(), "one assignment was actually signed");
        assertEquals(1, dto.requiredCount(), "only the required=true assignment counts toward requiredCount");
    }

    @Test
    void requiresMySignature_filtersToOnlyAssignedDocuments() {
        Long signer = createSignerMember();
        Document withAssignment = fixtures.createDocument(orgId);
        fixtures.createVersion(withAssignment, "content-a".getBytes());
        Document withoutAssignment = fixtures.createDocument(orgId);
        fixtures.createVersion(withoutAssignment, "content-b".getBytes());

        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", signer, "Signer",
                        null, null, null, null, null, "EXECUTOR", true)));
        routeService.createRoute(withAssignment.getId(),
                new SigningRouteDtos.CreateSigningRouteRequest("SEQUENTIAL", List.of(step)), ownerId);
        routeService.prepareForSigning(withAssignment.getId(), null, ownerId);
        routeService.sendForSigning(withAssignment.getId(), ownerId);

        DocumentFilter filter = new DocumentFilter(null, null, null, null, null, null,
                true, null, null, null, null, null, null);
        var page = documentService.list(orgId, filter, PageRequest.of(0, 20), signer);

        assertEquals(1, page.items().size());
        assertEquals(withAssignment.getId(), page.items().get(0).getId());
        assertTrue(page.items().stream().noneMatch(d -> d.getId().equals(withoutAssignment.getId())));
    }

    @Test
    void requiresMySignature_ignoresClientSuppliedSignerId_usesCurrentUserOnly() {
        Long signer = createSignerMember();
        Long impersonator = createUser();
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());

        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", signer, "Signer",
                        null, null, null, null, null, "EXECUTOR", true)));
        routeService.createRoute(document.getId(),
                new SigningRouteDtos.CreateSigningRouteRequest("SEQUENTIAL", List.of(step)), ownerId);
        routeService.prepareForSigning(document.getId(), null, ownerId);
        routeService.sendForSigning(document.getId(), ownerId);

        // signerId in the DocumentFilter record is accepted but must never drive the filter -
        // requiresMySignature is always evaluated against the actual caller (impersonator here),
        // who has no assignment at all, regardless of what signerId claims.
        DocumentFilter filter = new DocumentFilter(null, null, null, null, null, signer,
                true, null, null, null, null, null, null);
        var page = documentService.list(orgId, filter, PageRequest.of(0, 20), impersonator);

        assertEquals(0, page.items().size(), "requiresMySignature must never trust a client-supplied signerId");
    }
}
