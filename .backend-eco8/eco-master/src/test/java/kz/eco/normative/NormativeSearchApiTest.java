package kz.eco.normative;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;
import java.util.List;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class NormativeSearchApiTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private NormativeImportService importService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws IOException {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        ClassPathResource resource = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        importService.importResource(resource.getContentAsByteArray(),
                "MPC_atmospheric_air_with_pollutant_codes.xls.xls", null);
    }

    /** {@code @WithMockUser} sets a Spring UserDetails principal, which CurrentUser.get() (a real
     * kz.eco.user.User principal) treats as unauthenticated - see the same note in
     * CompanyApiTest. Only needed for the admin cross-context-fallback path below, which is the
     * only assertion in this class that actually calls CurrentUser.get(). */
    private void authenticateAsAdmin() {
        User user = new User();
        user.setEmail("normative-search-admin-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Admin Tester");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        userRepository.save(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_queryAzot_findsNitrogenDioxide() throws Exception {
        mockMvc.perform(get("/api/normatives/search").param("query", "азот"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.records", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data.records[?(@.indicator =~ /.*[Дд]иоксид.*/i)]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_code0301_findsNitrogenDioxide() throws Exception {
        mockMvc.perform(get("/api/normatives/search").param("code", "0301"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.pollutantCode == '0301')]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_code301_finds0301() throws Exception {
        mockMvc.perform(get("/api/normatives/search").param("code", "301"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.pollutantCode == '0301')]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_qNo2_findsByFormula() throws Exception {
        mockMvc.perform(get("/api/normatives/search").param("q", "NO2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.formula =~ /.*NO.*/i || @.chemicalFormula =~ /.*NO.*/i)]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_partialNikel_findsNikel() throws Exception {
        // Reproduces the reported bug exactly: partial query "нике" against the real seeded
        // DSM_138 directory (water) must find the "Никель" normative by name, not just by code.
        mockMvc.perform(get("/api/normatives/search").param("query", "нике"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.indicator == 'Никель')]").exists());

        mockMvc.perform(get("/api/normatives/search").param("query", "НИКЕ"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.indicator == 'Никель')]").exists());

        mockMvc.perform(get("/api/normatives/search").param("query", "  никел  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.indicator == 'Никель')]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_cas_findsByCasNumber() throws Exception {
        mockMvc.perform(get("/api/normatives/search").param("q", "10102-44-0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[?(@.casNumber == '10102-44-0')]").exists());
    }

    @Test
    @WithMockUser(roles = "LABORATORY")
    void search_wrongTemplateId_doesNotAutoFallback() throws Exception {
        // Cross-context fallback must never happen silently for a regular lab user - a wrong
        // templateId should surface an empty result, not a normative pulled from another
        // protocol type (see NormativeReferenceController#search).
        mockMvc.perform(get("/api/normatives/search")
                        .param("templateId", "soil")
                        .param("code", "301"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.found").value(false))
                .andExpect(jsonPath("$.data.records", hasSize(0)));
    }

    @Test
    void search_wrongTemplateId_adminExplicitFallback_findsAcrossContext() throws Exception {
        // Explicit opt-in, admin-only: broadening the search across protocol types is a browsing
        // convenience, never an implicit default (see effectiveAllowCrossContextFallback).
        authenticateAsAdmin();
        mockMvc.perform(get("/api/normatives/search")
                        .param("templateId", "soil")
                        .param("code", "301")
                        .param("allowCrossContextFallback", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.found").value(true))
                .andExpect(jsonPath("$.data.records[?(@.pollutantCode == '0301')]").exists())
                .andExpect(jsonPath("$.data.message").value("Норматив найден в другом разделе. Проверьте тип протокола."));
    }
}
