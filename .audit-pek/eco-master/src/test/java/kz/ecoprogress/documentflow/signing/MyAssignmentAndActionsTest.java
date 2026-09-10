package kz.ecoprogress.documentflow.signing;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.document.Document;
import kz.ecoprogress.documentflow.document.DocumentService;
import kz.ecoprogress.documentflow.document.dto.DocumentDtos;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.signing.dto.CurrentAssignmentDto;
import kz.ecoprogress.documentflow.signing.dto.SigningRouteDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Module spec §9/§10: SIGN/REJECT/RETURN_FOR_REVISION must appear in availableActions only for
 *  the user with the live assignment, and GET .../my-assignment must return exactly that user's
 *  own assignment (or null), never someone else's. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class MyAssignmentAndActionsTest {

    @Autowired private WebApplicationContext context;
    @Autowired private DocumentFlowTestFixtures fixtures;
    @Autowired private SigningRouteService routeService;
    @Autowired private DocumentService documentService;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;

    private MockMvc mockMvc;
    private Long orgId = 1L;
    private Long ownerId;
    private User signer;
    private User outsider;
    private Document document;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        ownerId = createUser("owner");
        fixtures.grantFullAccess(ownerId, orgId);

        signer = userRepository.findById(createUser("signer")).orElseThrow();
        DocumentFlowMembership m = new DocumentFlowMembership();
        m.setUserId(signer.getId());
        m.setOrganizationId(orgId);
        m.setRoleCode(MembershipRole.SIGNER);
        m.setStatus(MembershipStatus.ACTIVE);
        membershipRepository.save(m);

        outsider = userRepository.findById(createUser("outsider")).orElseThrow();

        document = fixtures.createDocument(orgId);
        fixtures.createVersion(document, "content".getBytes());
        var step = new SigningRouteDtos.CreateStepRequest(null, List.of(
                new SigningRouteDtos.CreateAssignmentRequest("ORGANIZATION_MEMBER", signer.getId(), "Signer",
                        null, null, null, null, null, "EXECUTOR", true)));
        routeService.createRoute(document.getId(),
                new SigningRouteDtos.CreateSigningRouteRequest("SEQUENTIAL", List.of(step)), ownerId);
        routeService.prepareForSigning(document.getId(), null, ownerId);
        routeService.sendForSigning(document.getId(), ownerId);
    }

    private Long createUser(String label) {
        User user = new User();
        user.setEmail("df-myassignment-" + label + "-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("MyAssignment " + label);
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);
        return user.getId();
    }

    private void authenticateAs(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))));
    }

    @Test
    void assignedSigner_seesSignRejectReturnActions() {
        DocumentDtos.DocumentDetailDto dto = documentService.toDetailDto(
                documentService.get(document.getId(), orgId), signer.getId(), orgId);
        assertTrue(dto.availableActions().contains("SIGN"));
        assertTrue(dto.availableActions().contains("REJECT"));
        assertTrue(dto.availableActions().contains("RETURN_FOR_REVISION"));
    }

    @Test
    void outsiderWithoutAssignment_doesNotSeeSignAction() {
        DocumentDtos.DocumentDetailDto dto = documentService.toDetailDto(
                documentService.get(document.getId(), orgId), outsider.getId(), orgId);
        assertTrue(dto.availableActions().stream().noneMatch(a -> a.equals("SIGN") || a.equals("REJECT")));
    }

    @Test
    void myAssignment_returnsOwnAssignment_forSigner() throws Exception {
        authenticateAs(signer);
        mockMvc.perform(get("/api/document-flow/documents/" + document.getId() + "/my-assignment"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentId").value(document.getId()))
                .andExpect(jsonPath("$.data.canSign").value(true))
                .andExpect(jsonPath("$.data.status").value("AVAILABLE"));
    }
}
