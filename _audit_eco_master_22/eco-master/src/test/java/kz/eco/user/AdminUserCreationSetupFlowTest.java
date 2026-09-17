package kz.eco.user;

import kz.eco.auth.PasswordResetToken;
import kz.eco.auth.PasswordResetTokenPurpose;
import kz.eco.auth.PasswordResetTokenRepository;
import kz.eco.auth.PasswordResetTokenStatus;
import kz.eco.mail.EmailOutbox;
import kz.eco.mail.EmailOutboxRepository;
import kz.eco.mail.EmailOutboxStatus;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Regression coverage for the POST /api/admin/users 500 (correlation ID 8c34f3d6): AdminUserService
 *  deliberately creates a staff account with passwordHash=null and status=pending_setup (module
 *  spec item 1 - the admin never sets a password, the user does via an emailed one-time link), and
 *  that must succeed end-to-end - the user row, the SETUP-purpose PasswordResetToken row (backed
 *  by user_password_tokens), and the email_outbox row, all in one transaction. See
 *  V108__users_password_setup_hardening.sql for the schema fix this test guards. */
@SpringBootTest
@Transactional
class AdminUserCreationSetupFlowTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PasswordResetTokenRepository tokenRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;

    private MockMvc mvc;
    private User admin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        admin = new User();
        admin.setEmail("admin-createflow-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.admin);
        admin.setStatus(UserStatus.active);
        userRepository.save(admin);
    }

    private RequestPostProcessor asAdmin() {
        return authentication(new UsernamePasswordAuthenticationToken(
                admin, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @Test
    void createStaffUser_succeeds_withNullPasswordAndPendingSetupStatus_andCreatesSetupTokenAndEmail() throws Exception {
        String email = "new-ecologist-" + System.nanoTime() + "@ecoprogress.kz";
        String body = """
                {"email":"%s","name":"Новый Эколог","phone":"+77011234567","city":"Алматы",
                 "role":"ECOLOGIST","position":"Инженер-эколог"}
                """.formatted(email);

        mvc.perform(post("/api/admin/users").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email))
                .andExpect(jsonPath("$.data.status").value("pending_setup"));

        // 1. The user row itself: passwordHash must be genuinely NULL (not an empty string, not a
        // placeholder hash) and status must be the real pending_setup enum value - this is exactly
        // the INSERT that failed with a 500 before the schema fix.
        User created = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertNull(created.getPasswordHash(), "passwordHash must be null until the user sets it themselves");
        assertEquals(UserStatus.pending_setup, created.getStatus());

        // 2. A SETUP-purpose PasswordResetToken row - proves user_password_tokens accepted the
        // insert (the table this migration restores if missing).
        Optional<PasswordResetToken> setupToken = tokenRepository
                .findFirstByUserIdAndPurposeAndStatusOrderByCreatedAtDesc(
                        created.getId(), PasswordResetTokenPurpose.SETUP, PasswordResetTokenStatus.PENDING);
        assertTrue(setupToken.isPresent(), "a SETUP token row must exist for the new user");
        assertNotNull(setupToken.get().getTokenHash());
        assertNotNull(setupToken.get().getExpiresAt());

        // 3. An email_outbox row queued to notify the new user of their setup link.
        List<EmailOutbox> emails = emailOutboxRepository.findByToEmailIgnoreCaseOrderByCreatedAtDesc(email);
        assertFalse(emails.isEmpty(), "an email_outbox row must be queued for the new user");
        assertEquals(EmailOutboxStatus.pending, emails.get(0).getStatus());
        assertTrue(emails.get(0).getBody().contains("/auth/setup-password/"),
                "the outbox email must contain the setup link, never the raw token logged elsewhere");
    }

    @Test
    void creatingSecondUserWithSameEmail_isRejected_withoutLeavingAPartialRow() throws Exception {
        String email = "dup-" + System.nanoTime() + "@ecoprogress.kz";
        String body = """
                {"email":"%s","name":"Первый","phone":"+77011234567","city":"Алматы",
                 "role":"ECOLOGIST","position":"Инженер-эколог"}
                """.formatted(email);
        mvc.perform(post("/api/admin/users").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        mvc.perform(post("/api/admin/users").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());

        assertTrue(userRepository.existsByEmailIgnoreCase(email));
        assertEquals(1, emailOutboxRepository.findByToEmailIgnoreCaseOrderByCreatedAtDesc(email).size(),
                "the rejected duplicate attempt must not have queued a second setup email");
    }
}
