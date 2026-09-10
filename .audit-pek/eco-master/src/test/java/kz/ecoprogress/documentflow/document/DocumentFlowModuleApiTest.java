package kz.ecoprogress.documentflow.document;

import com.jayway.jsonpath.JsonPath;
import kz.eco.EcoApplication;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import kz.ecoprogress.documentflow.plan.SubscriptionPlanRepository;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscription;
import kz.ecoprogress.documentflow.subscription.OrganizationSubscriptionRepository;
import kz.ecoprogress.documentflow.subscription.PaymentMode;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end coverage of the document-flow document core: DRAFT create -> upload a version ->
 * list shows the correct DocumentListItemDto shape -> PATCH edit -> forcing a non-DRAFT status
 * makes further edits a 409 DOCUMENT_NOT_EDITABLE, plus the "no membership" access denial.
 * Mirrors the style of kz.eco.pek.PekModuleApiTest.
 */
@SpringBootTest(classes = EcoApplication.class)
@Transactional
class DocumentFlowModuleApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private DocumentFlowMembershipRepository membershipRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private OrganizationSubscriptionRepository subscriptionRepository;
    @Autowired private SubscriptionPlanRepository planRepository;

    private MockMvc mockMvc;
    private User author;
    private Long organizationId = 5001L;

    private RequestPostProcessor asRole(User user, UserRole role) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        return authentication(auth);
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        author = new User();
        author.setEmail("df-author-" + System.nanoTime() + "@ecoprogress.kz");
        author.setPasswordHash(passwordEncoder.encode("demo123"));
        author.setName("Document Author");
        author.setRole(UserRole.MANAGER);
        author.setType(ClientType.staff);
        userRepository.save(author);

        DocumentFlowMembership membership = new DocumentFlowMembership();
        membership.setUserId(author.getId());
        membership.setOrganizationId(organizationId);
        membership.setRoleCode(MembershipRole.OWNER);
        membership.setStatus(MembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        Long planId = planRepository.findByCode("ENTERPRISE").orElseThrow().getId();
        OrganizationSubscription subscription = new OrganizationSubscription();
        subscription.setOrganizationId(organizationId);
        subscription.setPlanId(planId);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(LocalDateTime.now().minusDays(1));
        subscription.setExpiresAt(LocalDateTime.now().plusYears(1));
        subscription.setPaymentMode(PaymentMode.ADMIN_GRANT);
        subscriptionRepository.save(subscription);

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                author, null, List.of(new SimpleGrantedAuthority("ROLE_MANAGER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private Long createDraftDocument() throws Exception {
        String json = """
                {"documentType": "COMMERCIAL_OFFER", "direction": "OUTGOING", "title": "Договор поставки №1",
                 "description": "test", "organizationId": %d}
                """.formatted(organizationId);
        MvcResult result = mockMvc.perform(post("/api/document-flow/documents")
                        .with(asRole(author, UserRole.MANAGER))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    @Test
    void fullLifecycle_createUploadListPatch_andEditAfterNonDraftIs409() throws Exception {
        Long documentId = createDraftDocument();

        MockMultipartFile file = new MockMultipartFile(
                "file", "contract.pdf", MediaType.APPLICATION_PDF_VALUE, "hello world".getBytes());
        mockMvc.perform(multipart("/api/document-flow/documents/" + documentId + "/file")
                        .file(file)
                        .with(asRole(author, UserRole.MANAGER))
                        .param("organizationId", String.valueOf(organizationId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.versionNumber").value(1))
                .andExpect(jsonPath("$.data.locked").value(false));

        MvcResult listResult = mockMvc.perform(get("/api/document-flow/documents")
                        .with(asRole(author, UserRole.MANAGER))
                        .param("organizationId", String.valueOf(organizationId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].title").value("Договор поставки №1"))
                .andExpect(jsonPath("$.data.items[0].status").value("DRAFT"))
                .andExpect(jsonPath("$.data.items[0].counterparty").doesNotExist())
                .andExpect(jsonPath("$.data.items[0].author.fullName").value("Document Author"))
                .andExpect(jsonPath("$.data.items[0].permissions.canEdit").value(true))
                .andReturn();
        assertEquals(200, listResult.getResponse().getStatus());

        String patchJson = """
                {"title": "Договор поставки №1 (ред.)"}
                """;
        mockMvc.perform(patch("/api/document-flow/documents/" + documentId)
                        .with(asRole(author, UserRole.MANAGER))
                        .param("organizationId", String.valueOf(organizationId))
                        .contentType(MediaType.APPLICATION_JSON).content(patchJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Договор поставки №1 (ред.)"));

        // Force a non-DRAFT status directly via the repository (bypassing the not-yet-built
        // send-for-signing flow, which is Agent C's job) purely to prove the edit-after-non-DRAFT
        // guard actually fires.
        Document document = documentRepository.findById(documentId).orElseThrow();
        document.setStatus(DocumentStatus.READY_FOR_SIGNING);
        documentRepository.save(document);

        mockMvc.perform(patch("/api/document-flow/documents/" + documentId)
                        .with(asRole(author, UserRole.MANAGER))
                        .param("organizationId", String.valueOf(organizationId))
                        .contentType(MediaType.APPLICATION_JSON).content(patchJson))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENT_NOT_EDITABLE"));
    }

    @Test
    void userWithNoMembership_isDenied() throws Exception {
        User outsider = new User();
        outsider.setEmail("df-outsider-" + System.nanoTime() + "@ecoprogress.kz");
        outsider.setPasswordHash(passwordEncoder.encode("demo123"));
        outsider.setName("Outsider");
        outsider.setRole(UserRole.MANAGER);
        outsider.setType(ClientType.staff);
        userRepository.save(outsider);

        String json = """
                {"documentType": "COMMERCIAL_OFFER", "direction": "OUTGOING", "title": "X", "organizationId": %d}
                """.formatted(organizationId);
        mockMvc.perform(post("/api/document-flow/documents")
                        .with(asRole(outsider, UserRole.MANAGER))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteDraftDocument_succeeds() throws Exception {
        Long documentId = createDraftDocument();
        mockMvc.perform(delete("/api/document-flow/documents/" + documentId)
                        .with(asRole(author, UserRole.MANAGER))
                        .param("organizationId", String.valueOf(organizationId)))
                .andExpect(status().isOk());
        assertEquals(0, documentRepository.findById(documentId).stream().count());
    }

    @Test
    void documentTypesCatalog_isExposed() throws Exception {
        mockMvc.perform(get("/api/document-flow/document-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(org.hamcrest.Matchers.greaterThan(0)));
    }
}
