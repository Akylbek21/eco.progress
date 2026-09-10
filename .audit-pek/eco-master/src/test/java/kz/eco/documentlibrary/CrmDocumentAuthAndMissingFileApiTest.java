package kz.eco.documentlibrary;

import com.jayway.jsonpath.JsonPath;
import kz.eco.storage.FileStorageService;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Fills the remaining gaps not already covered by CrmDocumentApiTest/StaffDocumentsContractApiTest:
 *  a real end-to-end JWT (not just an injected SecurityContext), true unauthenticated (no
 *  Authorization header at all, not just a wrong role) requests, and a document row whose
 *  underlying stored file has been removed out-of-band. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class CrmDocumentAuthAndMissingFileApiTest {

    private static final String BASE = "/api/staff/documents";

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired CrmDocumentRepository documents;
    @Autowired FileStorageService fileStorageService;
    @Autowired PasswordEncoder passwordEncoder;

    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void unauthenticatedRequest_returns401OnEveryEndpoint() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/1/download")).andExpect(status().isUnauthorized());
        mvc.perform(multipart(BASE).file(pdf("x.pdf")).param("name", "t").param("category", "OTHER"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void uploadThenDownload_withRealJwt_succeeds() throws Exception {
        String email = "jwt-doc-" + System.nanoTime() + "@ecoprogress.kz";
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName("JWT Tester");
        u.setRole(UserRole.MANAGER);
        u.setType(ClientType.staff);
        users.save(u);

        String loginResponse = mvc.perform(post("/api/auth/staff/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"demo123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(loginResponse, "$.data.token");

        byte[] bytes = pdfBytes();
        MvcResult uploaded = mvc.perform(multipart(BASE)
                        .file(new MockMultipartFile("file", "jwt-flow.pdf", "application/pdf", bytes))
                        .param("name", "JWT flow doc")
                        .param("category", "OTHER")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        Long id = Long.valueOf(JsonPath.read(uploaded.getResponse().getContentAsString(), "$.data.id").toString());

        byte[] downloaded = mvc.perform(get(BASE + "/" + id + "/download")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        org.junit.jupiter.api.Assertions.assertArrayEquals(bytes, downloaded);
    }

    @Test
    void download_whenUnderlyingFileMissing_returns404NotServerError() throws Exception {
        User u = user("missing-file-", UserRole.ECOLOGIST);
        MvcResult uploaded = mvc.perform(multipart(BASE)
                        .file(pdf("will-vanish.pdf"))
                        .param("name", "will vanish")
                        .param("category", "OTHER")
                        .with(as(u)))
                .andExpect(status().isOk())
                .andReturn();
        Long id = Long.valueOf(JsonPath.read(uploaded.getResponse().getContentAsString(), "$.data.id").toString());

        CrmDocument document = documents.findById(id).orElseThrow();
        fileStorageService.delete(document.getFileId());

        mvc.perform(get(BASE + "/" + id + "/download").with(as(u)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getById_forNonexistentDocument_returns404() throws Exception {
        User u = user("missing-row-", UserRole.ECOLOGIST);
        mvc.perform(get(BASE + "/999999999").with(as(u)))
                .andExpect(status().isNotFound());
    }

    private static byte[] pdfBytes() {
        return "%PDF-1.4 auth/missing-file test body".getBytes(StandardCharsets.UTF_8);
    }

    private static MockMultipartFile pdf(String name) {
        return new MockMultipartFile("file", name, "application/pdf", pdfBytes());
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName(role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return users.save(u);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }
}
