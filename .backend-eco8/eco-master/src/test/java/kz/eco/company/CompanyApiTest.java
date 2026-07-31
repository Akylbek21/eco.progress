package kz.eco.company;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Note on authentication: CompanyController's mutating endpoints read CurrentUser.get(), which
 * only resolves when the security principal is the app's own kz.eco.user.User entity -
 * {@code @WithMockUser} sets a Spring UserDetails/username principal instead, which CurrentUser
 * treats as unauthenticated (401). So every test that expects a mutating call to actually run
 * (200/400/409, not just a 403 role rejection) authenticates a real, persisted User via
 * SecurityContextHolder instead, matching LaboratoryApiTest/LabJournalApiTest's pattern.
 */
@SpringBootTest
@Transactional
class CompanyApiTest {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        authenticateAs(UserRole.ADMIN);
    }

    private void authenticateAs(UserRole role) {
        User user = new User();
        user.setEmail("company-api-" + role + "-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName(role + " Tester");
        user.setRole(role);
        user.setType(ClientType.staff);
        userRepository.save(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private String createBody(String name, String bin) {
        return """
                {"name": "%s", "bin": "%s", "legalAddress": "г. Алматы", "phone": "+77011234567"}
                """.formatted(name, bin);
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void create_forbiddenForLaboratoryRole() throws Exception {
        // 403 happens in @PreAuthorize before the controller body (and CurrentUser.get()) ever
        // runs, so the mock-principal mismatch noted above doesn't affect this specific case.
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Лаборатория запрет", "100200300400")))
                .andExpect(status().isForbidden());
    }

    @Test
    void create_succeedsForAdmin_andAlsoCreatesPrimaryObject() throws Exception {
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Админ создаёт", "100200300401")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.objectCount").value(1));
    }

    @Test
    void create_duplicateBin_returns409WithCode() throws Exception {
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Первая", "100200300402")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Вторая с тем же БИН", "100200300402")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_BIN"))
                .andExpect(jsonPath("$.errors[0].field").value("bin"))
                .andExpect(jsonPath("$.errors[0].code").value("DUPLICATE_BIN"));
    }

    @Test
    void create_invalidBinFormat_returns400() throws Exception {
        mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Короткий БИН", "123")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void archivedCompany_cannotBeEdited() throws Exception {
        String response = mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Для архивации", "100200300403")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Long id = Long.valueOf(JsonPath.read(response, "$.data.id").toString());

        mockMvc.perform(post("/api/companies/" + id + "/archive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));

        mockMvc.perform(patch("/api/companies/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Попытка изменить архивную компанию\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMPANY_ARCHIVED"));
    }

    @Test
    void archive_isIdempotent() throws Exception {
        String response = mockMvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("ТОО Идемпотентная архивация", "100200300404")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Long id = Long.valueOf(JsonPath.read(response, "$.data.id").toString());

        mockMvc.perform(post("/api/companies/" + id + "/archive")).andExpect(status().isOk());
        mockMvc.perform(post("/api/companies/" + id + "/archive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void list_readableByLaboratoryRole() throws Exception {
        // GET never touches CurrentUser.get(), so the mock principal is fine here.
        mockMvc.perform(get("/api/companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
