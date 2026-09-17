package kz.ecoprogress.documentflow.signing;

import kz.eco.common.exception.BadRequestException;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Module spec §6: SigningRouteService.buildSteps used to save an ORGANIZATION_MEMBER assignment's
 * userId straight from the client with no check that the id belongs to the document's own
 * organization, is ACTIVE, or holds SIGN_DOCUMENT - a caller could hand any user id, including one
 * from a completely different organization, and that user would end up with a real signing
 * assignment (and, before this fix, could go on to actually sign the document). These tests
 * exercise SigningRouteService.createRoute directly, the same way SigningFlowTest does, since the
 * thing under test is the service-layer validation, not the HTTP layer.
 */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class SigningRouteIdorTest {

    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private SigningRouteService routeService;
    @Autowired private SigningAssignmentRepository assignmentRepository;
    @Autowired private SigningStepRepository stepRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;
    @Autowired private CompanyRepository companyRepository;

    private Long orgId;
    private Long otherOrgId;
    private Long ownerUserId;

    @BeforeEach
    void setUp() {
        orgId = createCompany("IDOR Org A " + System.nanoTime()).getId();
        otherOrgId = createCompany("IDOR Org B " + System.nanoTime()).getId();
        ownerUserId = createUser();
        fixtures.grantFullAccess(ownerUserId, orgId);
    }

    private Company createCompany(String name) {
        Company c = new Company();
        c.setName(name);
        c.setBin(String.valueOf(200000000000L + Math.abs(name.hashCode()) % 799999999999L));
        c.setLegalAddress("г. Алматы");
        c.setPhone("+77000000000");
        c.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.save(c);
    }

    private Long createUser() {
        User user = new User();
        user.setEmail("df-idor-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("IDOR Test User");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);
        return user.getId();
    }

    private DocumentFlowMembership addMembership(Long userId, Long organizationId, MembershipRole role, MembershipStatus status) {
        DocumentFlowMembership m = new DocumentFlowMembership();
        m.setUserId(userId);
        m.setOrganizationId(organizationId);
        m.setRoleCode(role);
        m.setStatus(status);
        return membershipRepository.save(m);
    }

    private SigningRouteDtos.CreateSigningRouteRequest routeFor(Long signerUserId) {
        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", signerUserId, "Signer",
                        null, null, null, null, null, "EXECUTOR", true)));
        return new SigningRouteDtos.CreateSigningRouteRequest("SEQUENTIAL", List.of(step));
    }

    @Test
    void userFromAnotherOrganization_cannotBeAssigned() {
        Long outsiderId = createUser();
        addMembership(outsiderId, otherOrgId, MembershipRole.SIGNER, MembershipStatus.ACTIVE);
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> routeService.createRoute(document.getId(), routeFor(outsiderId), ownerUserId));
        assertEquals("ASSIGNMENT_USER_NOT_MEMBER", ex.getCode());
    }

    @Test
    void suspendedMember_cannotBeAssigned() {
        Long suspendedId = createUser();
        addMembership(suspendedId, orgId, MembershipRole.SIGNER, MembershipStatus.SUSPENDED);
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> routeService.createRoute(document.getId(), routeFor(suspendedId), ownerUserId));
        assertEquals("ASSIGNMENT_USER_NOT_ACTIVE", ex.getCode());
    }

    @Test
    void memberWithoutSignPermission_cannotBeAssigned() {
        Long viewerId = createUser();
        addMembership(viewerId, orgId, MembershipRole.VIEWER, MembershipStatus.ACTIVE);
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> routeService.createRoute(document.getId(), routeFor(viewerId), ownerUserId));
        assertEquals("ASSIGNMENT_USER_CANNOT_SIGN", ex.getCode());
    }

    @Test
    void validActiveSignerInSameOrganization_isAssignedSuccessfully() {
        Long signerId = createUser();
        addMembership(signerId, orgId, MembershipRole.SIGNER, MembershipStatus.ACTIVE);
        Document document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());

        SigningRoute route = routeService.createRoute(document.getId(), routeFor(signerId), ownerUserId);

        List<SigningStep> steps = stepRepository.findAllByRouteIdOrderByStepOrderAsc(route.getId());
        SigningAssignment assignment = assignmentRepository.findAllByStepId(steps.get(0).getId()).get(0);
        assertEquals(signerId, assignment.getUserId());
    }
}
