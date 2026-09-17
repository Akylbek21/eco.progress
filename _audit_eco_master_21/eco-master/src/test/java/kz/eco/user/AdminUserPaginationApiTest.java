package kz.eco.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class AdminUserPaginationApiTest {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;
    private String suffix;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        suffix = "-pg-" + System.nanoTime();

        User admin = new User();
        admin.setEmail("admin" + suffix + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.admin);
        admin.setStatus(UserStatus.active);
        userRepository.save(admin);
        authenticate(admin);

        createUser("alice" + suffix + "@ecoprogress.kz", "Alice Manager", UserRole.MANAGER);
        createUser("bob" + suffix + "@ecoprogress.kz", "Bob Accountant", UserRole.ACCOUNTANT);
        createUser("carol" + suffix + "@ecoprogress.kz", "Carol Manager", UserRole.MANAGER);
    }

    private void createUser(String email, String name, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName(name);
        user.setRole(role);
        user.setType(ClientType.staff);
        user.setPhone("+77001234567");
        user.setCity("Алматы");
        user.setPosition("Позиция");
        user.setStatus(UserStatus.active);
        userRepository.save(user);
    }

    @Test
    void list_defaultPaging_returnsPageResponseShape() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.totalElements").exists())
                .andExpect(jsonPath("$.data.totalPages").exists());
    }

    @Test
    void list_filterByRole_returnsOnlyMatchingRole() throws Exception {
        mockMvc.perform(get("/api/admin/users").param("role", "MANAGER").param("limit", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.email=='alice" + suffix + "@ecoprogress.kz')]").exists())
                .andExpect(jsonPath("$.data.items[?(@.email=='bob" + suffix + "@ecoprogress.kz')]").doesNotExist());
    }

    @Test
    void list_searchByName_matches() throws Exception {
        mockMvc.perform(get("/api/admin/users").param("search", "Bob Accountant").param("limit", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].email").value("bob" + suffix + "@ecoprogress.kz"));
    }

    @Test
    void list_invalidSortField_returns400() throws Exception {
        mockMvc.perform(get("/api/admin/users").param("sort", "notAField"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_invalidLimit_returns400() throws Exception {
        mockMvc.perform(get("/api/admin/users").param("limit", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_pageSizeOne_paginatesAcrossPages() throws Exception {
        mockMvc.perform(get("/api/admin/users").param("search", suffix).param("role", "MANAGER")
                        .param("limit", "1").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.hasNext").value(true));
    }

    private static void authenticate(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
