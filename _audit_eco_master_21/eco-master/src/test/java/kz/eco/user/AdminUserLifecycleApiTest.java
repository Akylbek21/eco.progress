package kz.eco.user;

import kz.eco.audit.AuditLogRepository;
import kz.eco.mail.EmailOutboxRepository;
import kz.eco.auth.PasswordResetToken;
import kz.eco.auth.PasswordResetTokenPurpose;
import kz.eco.auth.PasswordResetTokenRepository;
import kz.eco.auth.PasswordResetTokenService;
import kz.eco.auth.PasswordResetTokenStatus;
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

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end coverage of the staff-account lifecycle:
 *  ADMIN creates employee -> pending_setup + one-time setup token -> employee sets a password ->
 *  ACTIVE. Complements {@link AdminUserCreationSetupFlowTest} (which guards the create-side schema)
 *  by pinning the error contract (stable errorCodes), the ADMIN-only authorization, and the
 *  single-use/expiry semantics of the setup token. */
@SpringBootTest
@Transactional
class AdminUserLifecycleApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private PasswordResetTokenRepository tokenRepository;
    @Autowired private PasswordResetTokenService passwordResetTokenService;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;

    private MockMvc mvc;
    private User admin;
    private User plainStaff;
    private String suffix;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = "-lc-" + System.nanoTime();

        admin = staff("admin" + suffix + "@ecoprogress.kz", UserRole.ADMIN, ClientType.admin);
        plainStaff = staff("ecologist" + suffix + "@ecoprogress.kz", UserRole.ECOLOGIST, ClientType.staff);
    }

    private User staff(String email, UserRole role, ClientType type) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Тестовый " + role.name());
        user.setRole(role);
        user.setType(type);
        user.setPhone("+77001234567");
        user.setCity("Алматы");
        user.setPosition("Позиция");
        user.setStatus(UserStatus.active);
        return userRepository.save(user);
    }

    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
    }

    private String createBody(String email, String role) {
        return """
                {"email":"%s","name":"Новый Сотрудник","phone":"+77011234567",
                 "city":"Алматы","position":"Эколог","role":"%s"}
                """.formatted(email, role);
    }

    /** TEST 1: ADMIN creates an ECOLOGIST -> the account exists with no password, pending_setup. */
    @Test
    void adminCreatesEcologist_persistsPendingSetupAccountWithoutPassword() throws Exception {
        String email = "new-eco" + suffix + "@ecoprogress.kz";

        mvc.perform(post("/api/admin/users").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody(email, "ECOLOGIST")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value(email));

        User created = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertNull(created.getPasswordHash(), "admin must never set the password");
        assertEquals(UserStatus.pending_setup, created.getStatus());
        assertEquals(UserRole.ECOLOGIST, created.getRole());

        assertTrue(auditLogRepository.findAll().stream().anyMatch(a ->
                UserAuditAction.USER_CREATED.equals(a.getActionType())
                        && created.getId().equals(a.getEntityId())));
        assertTrue(auditLogRepository.findAll().stream().anyMatch(a ->
                UserAuditAction.SETUP_LINK_CREATED.equals(a.getActionType())
                        && created.getId().equals(a.getEntityId())));
    }

    /** The emailed setup link must be an absolute URL: a mail client cannot resolve a bare
     *  "/auth/setup-password/..." path, so the invitee had nothing to click. */
    @Test
    void setupEmail_containsAbsoluteClickableLink_andNeverThePassword() throws Exception {
        String email = "link-check" + suffix + "@ecoprogress.kz";

        mvc.perform(post("/api/admin/users").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody(email, "ECOLOGIST")))
                .andExpect(status().isOk());

        String body = emailOutboxRepository.findAll().stream()
                .filter(row -> email.equals(row.getToEmail()))
                .map(kz.eco.mail.EmailOutbox::getBody)
                .findFirst().orElseThrow();

        assertTrue(body.contains("://"), "link must be absolute, was: " + body);
        assertTrue(body.contains("/auth/setup-password/"), "link must point at the setup page");
        assertFalse(body.toLowerCase().contains("пароль:"), "the password must never be emailed");
    }

    /** TEST 2: a duplicate email is a 409 carrying the stable EMAIL_ALREADY_EXISTS code. */
    @Test
    void duplicateEmail_returns409_withEmailAlreadyExistsCode() throws Exception {
        mvc.perform(post("/api/admin/users").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(plainStaff.getEmail(), "ECOLOGIST")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    /** TEST 3: a role outside UserRole (e.g. the frontend-only LAB_HEAD) is rejected, not coerced. */
    @Test
    void unknownRole_returns400_withInvalidRoleCode() throws Exception {
        mvc.perform(post("/api/admin/users").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("bad-role" + suffix + "@ecoprogress.kz", "LAB_HEAD")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ROLE"));
    }

    /** TEST 4 / IDOR: a non-ADMIN staff account cannot create users or read the full staff list. */
    @Test
    void nonAdmin_isForbidden_fromAdminUserEndpoints() throws Exception {
        mvc.perform(post("/api/admin/users").with(as(plainStaff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("nope" + suffix + "@ecoprogress.kz", "ECOLOGIST")))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/admin/users").with(as(plainStaff)))
                .andExpect(status().isForbidden());
    }

    /** A non-ADMIN must not be able to edit another employee by walking the id (IDOR). */
    @Test
    void nonAdmin_cannotPatchAnotherUserById() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/admin/users/" + admin.getId()).with(as(plainStaff))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Взломано\"}"))
                .andExpect(status().isForbidden());

        assertEquals("Тестовый ADMIN", userRepository.findById(admin.getId()).orElseThrow().getName());
    }

    /** TEST 5: a valid setup token sets the password, activates the account and burns the token. */
    @Test
    void validSetupToken_setsPasswordAndActivatesUser() throws Exception {
        User pending = pendingUser();
        PasswordResetTokenService.Created created =
                passwordResetTokenService.create(pending, PasswordResetTokenPurpose.SETUP);

        mvc.perform(post("/api/auth/setup-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"NewPassw0rd!\"}"
                                .formatted(created.rawToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        User after = userRepository.findById(pending.getId()).orElseThrow();
        assertNotNull(after.getPasswordHash());
        assertTrue(passwordEncoder.matches("NewPassw0rd!", after.getPasswordHash()));
        assertEquals(UserStatus.active, after.getStatus());

        PasswordResetToken token = tokenRepository.findById(created.token().getId()).orElseThrow();
        assertEquals(PasswordResetTokenStatus.USED, token.getStatus());
        assertNotNull(token.getUsedAt());

        assertTrue(auditLogRepository.findAll().stream().anyMatch(a ->
                UserAuditAction.PASSWORD_SETUP_COMPLETED.equals(a.getActionType())
                        && pending.getId().equals(a.getEntityId())));
    }

    /** TEST 6: the token is single-use - replaying it must not touch the account again. */
    @Test
    void reusedSetupToken_isRejected() throws Exception {
        User pending = pendingUser();
        PasswordResetTokenService.Created created =
                passwordResetTokenService.create(pending, PasswordResetTokenPurpose.SETUP);
        String body = "{\"token\":\"%s\",\"password\":\"NewPassw0rd!\"}".formatted(created.rawToken());

        mvc.perform(post("/api/auth/setup-password")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());

        mvc.perform(post("/api/auth/setup-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"Different1!\"}"
                                .formatted(created.rawToken())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SETUP_TOKEN_INVALID"));

        User after = userRepository.findById(pending.getId()).orElseThrow();
        assertTrue(passwordEncoder.matches("NewPassw0rd!", after.getPasswordHash()),
                "the replayed call must not have overwritten the password");
    }

    /** TEST 7: an expired token is refused and the account stays in pending_setup. */
    @Test
    void expiredSetupToken_isRejected() throws Exception {
        User pending = pendingUser();
        PasswordResetTokenService.Created created =
                passwordResetTokenService.create(pending, PasswordResetTokenPurpose.SETUP);

        PasswordResetToken token = tokenRepository.findById(created.token().getId()).orElseThrow();
        token.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        tokenRepository.saveAndFlush(token);

        mvc.perform(post("/api/auth/setup-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"NewPassw0rd!\"}"
                                .formatted(created.rawToken())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SETUP_TOKEN_EXPIRED"));

        User after = userRepository.findById(pending.getId()).orElseThrow();
        assertNull(after.getPasswordHash());
        assertEquals(UserStatus.pending_setup, after.getStatus());
    }

    /** An unknown token must not reveal whether it ever existed. */
    @Test
    void unknownSetupToken_isRejected() throws Exception {
        mvc.perform(post("/api/auth/setup-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"definitely-not-a-real-token\",\"password\":\"NewPassw0rd!\"}"))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code").value("SETUP_TOKEN_INVALID"));
    }

    /** TEST 8: the list endpoint returns the documented paginated envelope at the limit boundary. */
    @Test
    void listUsers_atMaxLimit_returnsPaginatedEnvelope() throws Exception {
        mvc.perform(get("/api/admin/users?page=0&limit=100").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(100))
                .andExpect(jsonPath("$.data.totalElements").isNumber())
                .andExpect(jsonPath("$.data.totalPages").isNumber());
    }

    /** Editing profile fields must not silently clear the credentials or the account state. */
    @Test
    void updatingProfileFields_preservesPasswordHashStatusAndRole() throws Exception {
        String hashBefore = plainStaff.getPasswordHash();

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/admin/users/" + plainStaff.getId()).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Обновлённое Имя\",\"phone\":\"+77779998877\"}"))
                .andExpect(status().isOk());

        User after = userRepository.findById(plainStaff.getId()).orElseThrow();
        assertEquals("Обновлённое Имя", after.getName());
        assertEquals("+77779998877", after.getPhone());
        assertEquals(hashBefore, after.getPasswordHash());
        assertEquals(UserStatus.active, after.getStatus());
        assertEquals(UserRole.ECOLOGIST, after.getRole());
    }

    /** A second account must not be able to claim an ИИН already bound to someone else. */
    @Test
    void duplicateIin_returns409_withIinAlreadyExistsCode() throws Exception {
        plainStaff.setIin("880101300123");
        userRepository.saveAndFlush(plainStaff);

        String body = """
                {"email":"%s","name":"Новый Сотрудник","phone":"+77011234567",
                 "city":"Алматы","position":"Эколог","role":"ECOLOGIST","iin":"880101300123"}
                """.formatted("dup-iin" + suffix + "@ecoprogress.kz");

        mvc.perform(post("/api/admin/users").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IIN_ALREADY_EXISTS"));
    }

    private User pendingUser() {
        User user = new User();
        user.setEmail("pending" + suffix + "-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(null);
        user.setName("Ожидает Настройки");
        user.setRole(UserRole.ECOLOGIST);
        user.setType(ClientType.staff);
        user.setPhone("+77001234567");
        user.setCity("Алматы");
        user.setPosition("Эколог");
        user.setStatus(UserStatus.pending_setup);
        return userRepository.saveAndFlush(user);
    }
}
