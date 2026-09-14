package kz.eco.content;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verification workflow for Expert/TrustDocument: production data must never sit
 *  UNVERIFIED/PENDING_VERIFICATION forever while being treated as confirmed - only a real
 *  verify() call (by an ADMIN/DIRECTOR, version-checked) flips a record to VERIFIED and makes it
 *  eligible for isPubliclyVisible(). */
@SpringBootTest
@Transactional
class ExpertAndTrustDocumentVerificationTest {

    @Autowired private WebApplicationContext context;
    @Autowired private ExpertRepository expertRepository;
    @Autowired private TrustDocumentRepository trustDocumentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User admin;
    private User manager;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = user("verify-admin-", UserRole.ADMIN);
        manager = user("verify-manager-", UserRole.MANAGER);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name() + " Tester");
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    // ---- Expert -----------------------------------------------------------------------------

    private Long expertId;

    private Expert unverifiedExpert() {
        Expert e = new Expert();
        e.setFullName("Иванов Иван Иванович");
        e.setPosition("Ведущий эколог-эксперт");
        e.setCredentials("Диплом эколога, стаж 12 лет");
        Expert saved = expertRepository.save(e);
        expertId = saved.getId();
        return saved;
    }

    @Test
    void newExpert_defaultsToUnverified_andIsNotPubliclyVisible() {
        Expert e = unverifiedExpert();
        org.junit.jupiter.api.Assertions.assertEquals(VerificationStatus.UNVERIFIED, e.getVerificationStatus());
        org.junit.jupiter.api.Assertions.assertFalse(e.isPubliclyVisible());
    }

    @Test
    void expert_verify_beforeSubmission_isRejected() throws Exception {
        unverifiedExpert();
        mvc.perform(post("/api/admin/content/experts/" + expertId + "/verify").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXPERT_NOT_PENDING"));
    }

    @Test
    void expert_fullVerificationFlow_endsVerifiedWithVerifierAndTimestamp() throws Exception {
        unverifiedExpert();
        mvc.perform(post("/api/admin/content/experts/" + expertId + "/submit-verification").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verificationStatus").value("PENDING_VERIFICATION"));

        mvc.perform(post("/api/admin/content/experts/" + expertId + "/verify").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verificationStatus").value("VERIFIED"))
                .andExpect(jsonPath("$.data.verifiedAt").isNotEmpty());

        Expert reloaded = expertRepository.findById(expertId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(reloaded.isPubliclyVisible());
        org.junit.jupiter.api.Assertions.assertEquals(admin.getId(), reloaded.getVerifierId());
    }

    @Test
    void expert_verify_withStaleVersion_returns409VersionConflict() throws Exception {
        unverifiedExpert();
        mvc.perform(post("/api/admin/content/experts/" + expertId + "/submit-verification").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/content/experts/" + expertId + "/verify").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void expert_verificationEndpoints_areForbiddenForManager() throws Exception {
        unverifiedExpert();
        mvc.perform(post("/api/admin/content/experts/" + expertId + "/submit-verification").with(as(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isForbidden());
    }

    // ---- TrustDocument ------------------------------------------------------------------------

    private Long documentId;

    private TrustDocument unverifiedDocument() {
        TrustDocument d = new TrustDocument();
        d.setDocumentType("Аттестат аккредитации лаборатории");
        d.setDocumentNumber("KZ.T.02.1234");
        d.setIssuedBy("НЦА РК");
        d.setIssuedAt(java.time.LocalDate.of(2024, 1, 10));
        d.setValidUntil(java.time.LocalDate.of(2029, 1, 10));
        d.setSourceUrl("https://nca.kz/registry/1234");
        TrustDocument saved = trustDocumentRepository.save(d);
        documentId = saved.getId();
        return saved;
    }

    @Test
    void newTrustDocument_defaultsToUnverified_andIsNotPubliclyVisible() {
        TrustDocument d = unverifiedDocument();
        org.junit.jupiter.api.Assertions.assertFalse(d.isPubliclyVisible());
    }

    @Test
    void trustDocument_fullVerificationFlow_endsVerifiedAndPubliclyVisible() throws Exception {
        unverifiedDocument();
        mvc.perform(post("/api/admin/content/trust-documents/" + documentId + "/submit-verification").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post("/api/admin/content/trust-documents/" + documentId + "/verify").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verificationStatus").value("VERIFIED"));

        TrustDocument reloaded = trustDocumentRepository.findById(documentId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(reloaded.isPubliclyVisible());
    }

    @Test
    void trustDocument_expiredEvenIfVerified_isNotPubliclyVisible() {
        TrustDocument d = new TrustDocument();
        d.setDocumentType("Лицензия");
        d.setVerificationStatus(VerificationStatus.VERIFIED);
        d.setValidUntil(java.time.LocalDate.of(2020, 1, 1));
        org.junit.jupiter.api.Assertions.assertFalse(d.isPubliclyVisible());
    }

    @Test
    void trustDocument_verificationEndpoints_areForbiddenForManager() throws Exception {
        unverifiedDocument();
        mvc.perform(post("/api/admin/content/trust-documents/" + documentId + "/submit-verification").with(as(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isForbidden());
    }
}
