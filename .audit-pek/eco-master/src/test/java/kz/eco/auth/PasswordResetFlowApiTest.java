package kz.eco.auth;

import kz.eco.mail.EmailEvent;
import kz.eco.mail.EmailOutboxRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class PasswordResetFlowApiTest {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private PasswordResetTokenService passwordResetTokenService;
    @Autowired
    private PasswordResetTokenRepository tokenRepository;
    @Autowired
    private EmailOutboxRepository emailOutboxRepository;

    private MockMvc mockMvc;

    private MockMvc mvc() {
        if (mockMvc == null) {
            mockMvc = MockMvcBuilders.webAppContextSetup(context)
                    .apply(SecurityMockMvcConfigurers.springSecurity()).build();
        }
        return mockMvc;
    }

    private User createPendingUser() {
        User user = new User();
        user.setEmail("pending-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(null);
        user.setName("Pending User");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        user.setStatus(UserStatus.pending_setup);
        return userRepository.save(user);
    }

    @Test
    void setupPassword_happyPath_activatesAccountAndAllowsLogin() throws Exception {
        User user = createPendingUser();
        PasswordResetTokenService.Created created =
                passwordResetTokenService.create(user, PasswordResetTokenPurpose.SETUP);

        mvc().perform(post("/api/auth/setup-password/" + created.rawToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"newPassword1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertEquals(UserStatus.active, reloaded.getStatus());
        assertTrue(passwordEncoder.matches("newPassword1", reloaded.getPasswordHash()));

        mvc().perform(post("/api/auth/staff/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"newPassword1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").exists());
    }

    @Test
    void setupPassword_expiredToken_returns400() throws Exception {
        User user = createPendingUser();
        PasswordResetTokenService.Created created =
                passwordResetTokenService.create(user, PasswordResetTokenPurpose.SETUP);
        PasswordResetToken token = tokenRepository.findByTokenHash(
                        kz.ecoprogress.documentflow.signing.Sha256Util.sha256Hex(created.rawToken()))
                .orElseThrow();
        token.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        tokenRepository.save(token);

        mvc().perform(post("/api/auth/setup-password/" + created.rawToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"newPassword1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void setupPassword_unknownToken_returns404() throws Exception {
        mvc().perform(post("/api/auth/setup-password/does-not-exist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"newPassword1\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void forgotPassword_unknownEmail_stillReturns200GenericMessage() throws Exception {
        mvc().perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"no-such-user-" + System.nanoTime() + "@ecoprogress.kz\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void resetPassword_invalidatesOldSessions() throws Exception {
        User user = new User();
        user.setEmail("reset-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("oldPassword1"));
        user.setName("Reset User");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        user.setStatus(UserStatus.active);
        userRepository.save(user);

        String loginResponse = mvc().perform(post("/api/auth/staff/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"oldPassword1\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Matcher matcher = Pattern.compile("\"token\":\"([^\"]+)\"").matcher(loginResponse);
        assertTrue(matcher.find());
        String oldToken = matcher.group(1);

        mvc().perform(get("/api/auth/me").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isOk());

        PasswordResetTokenService.Created resetToken =
                passwordResetTokenService.create(user, PasswordResetTokenPurpose.RESET);
        mvc().perform(post("/api/auth/reset-password/" + resetToken.rawToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"brandNewPassword1\"}"))
                .andExpect(status().isOk());

        mvc().perform(get("/api/auth/me").header("Authorization", "Bearer " + oldToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminCreateUser_noLongerAcceptsPassword_andSendsSetupEmail() throws Exception {
        User admin = new User();
        admin.setEmail("admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.admin);
        admin.setStatus(UserStatus.active);
        userRepository.save(admin);
        authenticate(admin);

        String newEmail = "created-" + System.nanoTime() + "@ecoprogress.kz";
        mvc().perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "name": "Новый Сотрудник",
                                  "phone": "+77001234567",
                                  "city": "Алматы",
                                  "role": "MANAGER",
                                  "position": "Менеджер"
                                }
                                """.formatted(newEmail)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("pending_setup"))
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist());

        User created = userRepository.findByEmailIgnoreCase(newEmail).orElseThrow();
        assertEquals(UserStatus.pending_setup, created.getStatus());
        assertEquals(null, created.getPasswordHash());

        List<kz.eco.mail.EmailOutbox> outbox = emailOutboxRepository.findByToEmailIgnoreCaseOrderByCreatedAtDesc(newEmail);
        assertEquals(1, outbox.size());
        assertEquals(EmailEvent.PASSWORD_SETUP_REQUESTED, outbox.get(0).getEventType());
    }

    private static void authenticate(User user) {
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                user, null,
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
