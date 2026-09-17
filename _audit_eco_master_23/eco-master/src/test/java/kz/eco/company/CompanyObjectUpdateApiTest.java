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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Optimistic-locking contract for PATCH /api/companies/{companyId}/objects/{objectId}.
 *
 * Rules under test:
 * - GET /{objectId} returns $.data.version (the value the frontend must echo as If-Match).
 * - PATCH with correct If-Match version → 200, version incremented in response.
 * - PATCH without If-Match header → 400 VERSION_REQUIRED.
 * - PATCH with stale If-Match → 409 VERSION_CONFLICT.
 * - PATCH with version in body (legacy fallback) → 200 when no If-Match header is present.
 */
@SpringBootTest
@Transactional
class CompanyObjectUpdateApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private Long companyId;
    private Long objectId;
    private Long objectVersion;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        authenticateAdmin();

        // Create a company
        String companyResp = mvc.perform(post("/api/companies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"ТОО Тест Объект","bin":"999888777666",
                                 "legalAddress":"г. Алматы","phone":"+77011111111"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        companyId = Long.valueOf(JsonPath.read(companyResp, "$.data.id").toString());

        // Create an object under that company
        String objResp = mvc.perform(post("/api/companies/" + companyId + "/objects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Производственный цех №1","address":"ул. Промышленная, 1",
                                 "activityType":"Производство","primary":false}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        objectId = Long.valueOf(JsonPath.read(objResp, "$.data.id").toString());
        objectVersion = Long.valueOf(JsonPath.read(objResp, "$.data.version").toString());
    }

    // ── GET returns version ──────────────────────────────────────────────────────────────────────

    @Test
    void getObject_returnsVersion_inResponse() throws Exception {
        mvc.perform(get("/api/companies/" + companyId + "/objects/" + objectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").exists())
                .andExpect(jsonPath("$.data.version").isNumber());
    }

    // ── Successful update via If-Match header ────────────────────────────────────────────────────

    @Test
    void patch_withCorrectIfMatch_returns200_andVersionIsIncremented() throws Exception {
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", objectVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Производственный цех №1 (обновлено)","address":"ул. Промышленная, 1"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Производственный цех №1 (обновлено)"))
                .andExpect(jsonPath("$.data.version").value(objectVersion + 1));
    }

    @Test
    void patch_responseContainsAllContractFields() throws Exception {
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", objectVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Обновлённый объект","address":"ул. Новая, 5",
                                 "activityType":"Хранение","region":"Алматинская область"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(objectId))
                .andExpect(jsonPath("$.data.companyId").value(companyId))
                .andExpect(jsonPath("$.data.name").value("Обновлённый объект"))
                .andExpect(jsonPath("$.data.address").value("ул. Новая, 5"))
                .andExpect(jsonPath("$.data.activityType").value("Хранение"))
                .andExpect(jsonPath("$.data.region").value("Алматинская область"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.version").isNumber());
    }

    // ── Missing version → 400 ────────────────────────────────────────────────────────────────────

    @Test
    void patch_withNoIfMatchHeader_andNoBodyVersion_returns400_versionRequired() throws Exception {
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Попытка без версии"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    // ── Stale version → 409 VERSION_CONFLICT ─────────────────────────────────────────────────────

    @Test
    void patch_withStaleIfMatch_returns409_versionConflict() throws Exception {
        long staleVersion = objectVersion - 1; // deliberately wrong
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", staleVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Попытка с устаревшей версией"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void patch_withFutureIfMatch_returns409_versionConflict() throws Exception {
        long futureVersion = objectVersion + 99;
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", futureVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Попытка с неверной версией"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    // ── Legacy body-version fallback (If-Match absent, version in body) ──────────────────────────

    @Test
    void patch_withVersionInBody_andNoIfMatchHeader_returns200() throws Exception {
        // Backward-compat: callers that still send version in the body (no If-Match) continue to
        // work. Once all clients migrate to If-Match this fallback can be dropped.
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Обновление через body","version":%d}
                                """.formatted(objectVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Обновление через body"))
                .andExpect(jsonPath("$.data.version").value(objectVersion + 1));
    }

    @Test
    void patch_ifMatchTakesPrecedenceOverBodyVersion() throws Exception {
        // If both If-Match and body.version are present, If-Match wins.
        // Use a correct If-Match with a wrong body.version → should succeed (not 409).
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", objectVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Приоритет If-Match","version":9999}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Приоритет If-Match"));
    }

    // ── Consecutive updates increment version monotonically ──────────────────────────────────────

    @Test
    void patch_consecutiveUpdates_incrementVersionMonotonically() throws Exception {
        // First update
        MvcResult r1 = mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", objectVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Версия 2\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long v1 = Long.parseLong(JsonPath.read(r1.getResponse().getContentAsString(), "$.data.version").toString());

        // Second update using the new version from the first response
        MvcResult r2 = mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", v1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Версия 3\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long v2 = Long.parseLong(JsonPath.read(r2.getResponse().getContentAsString(), "$.data.version").toString());

        org.junit.jupiter.api.Assertions.assertTrue(v2 > v1,
                "Each update must produce a strictly higher version: v1=" + v1 + " v2=" + v2);

        // Using the original (now stale) version must fail
        mvc.perform(patch("/api/companies/" + companyId + "/objects/" + objectId)
                        .header("If-Match", objectVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Попытка с исходной версией\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────────

    private void authenticateAdmin() {
        User admin = new User();
        admin.setEmail("obj-update-admin-" + System.nanoTime() + "@test.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin Tester");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        admin, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
}
