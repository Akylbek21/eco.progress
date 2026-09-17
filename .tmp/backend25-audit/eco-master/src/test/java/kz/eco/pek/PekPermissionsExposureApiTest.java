package kz.eco.pek;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.eco.user.UserStatus;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Guards the production bug where /api/auth/me returned no {@code permissions} field, so the UI
 *  let an ADMIN open ПЭК but blocked every action with "Нет доступа". Also pins that the field is
 *  advisory: the backend enforces PEK rights on its own regardless of what a client believes. */
@SpringBootTest
@Transactional
class PekPermissionsExposureApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private String suffix;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = "-pekperm-" + System.nanoTime();
    }

    private User user(UserRole role, ClientType type) {
        User user = new User();
        user.setEmail(role.name().toLowerCase() + suffix + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Тестовый " + role.name());
        user.setRole(role);
        user.setType(type);
        user.setPhone("+77001234567");
        user.setCity("Алматы");
        user.setPosition("Позиция");
        user.setStatus(UserStatus.active);
        return userRepository.saveAndFlush(user);
    }

    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
    }

    /** The actual regression: ADMIN must see the PEK_* action permissions, not just PEK_VIEW. */
    @Test
    void me_forAdmin_containsFullPekPermissionSet() throws Exception {
        mvc.perform(get("/api/auth/me").with(as(user(UserRole.ADMIN, ClientType.admin))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissions").isArray())
                .andExpect(jsonPath("$.data.permissions", org.hamcrest.Matchers.hasItems(
                        "PEK_VIEW", "PEK_PROGRAM_VIEW", "PEK_PROGRAM_CREATE", "PEK_PROGRAM_EDIT",
                        "PEK_PROGRAM_SUBMIT", "PEK_PROGRAM_APPROVE", "PEK_PROGRAM_ACTIVATE",
                        "PEK_PROGRAM_ARCHIVE", "PEK_REPORT_VIEW", "PEK_REPORT_CREATE",
                        "PEK_REPORT_EDIT", "PEK_REPORT_COLLECT", "PEK_REPORT_MATCH",
                        "PEK_REPORT_VALIDATE", "PEK_REPORT_REVIEW", "PEK_REPORT_RETURN",
                        "PEK_REPORT_APPROVE", "PEK_REPORT_SIGN", "PEK_REPORT_SUBMIT",
                        "PEK_REPORT_EXPORT", "PEK_SETTINGS_EDIT", "PEK_ADMIN")));
    }

    @Test
    void me_forEcologist_omitsSupervisorOnlyPermissions() throws Exception {
        mvc.perform(get("/api/auth/me").with(as(user(UserRole.ECOLOGIST, ClientType.staff))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissions", org.hamcrest.Matchers.hasItems(
                        "PEK_VIEW", "PEK_PROGRAM_CREATE", "PEK_REPORT_EDIT")))
                .andExpect(jsonPath("$.data.permissions", org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.hasItem("PEK_ADMIN"))))
                .andExpect(jsonPath("$.data.permissions", org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.hasItem("PEK_PROGRAM_APPROVE"))));
    }

    @Test
    void me_forClient_containsNoPekPermissions() throws Exception {
        mvc.perform(get("/api/auth/me").with(as(user(UserRole.CLIENT, ClientType.company))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissions").isEmpty());
    }

    /** The permissions field is advisory: a role without PEK_PROGRAM_CREATE is still refused by
     *  the endpoint's own @PreAuthorize, so a tampered client gains nothing. */
    @Test
    void backendStillEnforcesIndependently_accountantCannotCreateProgram() throws Exception {
        mvc.perform(post("/api/pek/programs").with(as(user(UserRole.ACCOUNTANT, ClientType.staff)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\":1,\"objectId\":1,\"year\":2026}"))
                .andExpect(status().isForbidden());
    }

    /** ACCOUNTANT holds PEK_VIEW, so read access must keep working - this pins that the fix did
     *  not tighten anything that used to be allowed. */
    @Test
    void viewOnlyRole_canStillListPrograms() throws Exception {
        mvc.perform(get("/api/pek/programs").with(as(user(UserRole.ACCOUNTANT, ClientType.staff))))
                .andExpect(status().isOk());
    }
}
