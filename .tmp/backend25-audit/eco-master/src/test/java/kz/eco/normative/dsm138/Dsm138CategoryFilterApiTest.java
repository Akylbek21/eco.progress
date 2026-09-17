package kz.eco.normative.dsm138;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
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

import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Confirms the exact filter combinations the /staff/normatives DSM_138 tab is expected to send
 * (per the "DSM_138 categories return 0" ticket) actually resolve to non-empty results once
 * Dsm138ResourceSeeder has auto-imported classpath:dsm-water/*.xls at startup.
 */
@SpringBootTest
@Transactional
class Dsm138CategoryFilterApiTest {

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
        User user = new User();
        user.setEmail("dsm138-cat-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Normatives Reader");
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_LABORATORY"))));
    }

    @Test
    void dsm138_totalCount_isNonZero() throws Exception {
        mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", "DSM_138")
                        .param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements", greaterThan(0)));
    }

    @Test
    void drinkingWaterChemicals_appendix2_isNonZero() throws Exception {
        mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", "DSM_138")
                        .param("categoryCode", "DRINKING_WATER_CHEMICALS")
                        .param("appendixNo", "2")
                        .param("page", "0").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements", greaterThan(0)));
    }

    @Test
    void surfaceWaterPdk_appendix4_isNonZero() throws Exception {
        mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", "DSM_138")
                        .param("categoryCode", "SURFACE_WATER_PDK")
                        .param("appendixNo", "4")
                        .param("page", "0").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements", greaterThan(0)));
    }

    @Test
    void drinkingWaterSafety_appendix1Table2_isNonZero() throws Exception {
        mockMvc.perform(get("/api/normatives/records")
                        .param("sourceDocumentCode", "DSM_138")
                        .param("categoryCode", "DRINKING_WATER_SAFETY")
                        .param("appendixNo", "1")
                        .param("tableNo", "2")
                        .param("page", "0").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements", greaterThan(0)));
    }
}
