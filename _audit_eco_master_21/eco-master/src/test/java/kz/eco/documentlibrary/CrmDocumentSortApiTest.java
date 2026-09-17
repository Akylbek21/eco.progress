package kz.eco.documentlibrary;

import com.jayway.jsonpath.JsonPath;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Covers GET /api/staff/documents?sort=... - the frontend sends its own field names
 *  (uploadedAt/name) which don't match the CrmDocument entity's actual properties
 *  (createdAt/title); CrmDocumentController#parseSort must alias them rather than pass them
 *  straight into Sort.by (which would throw), and an unknown field must fall back safely
 *  instead of 500ing. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class CrmDocumentSortApiTest {

    private static final String BASE = "/api/staff/documents";

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;

    MockMvc mvc;
    User owner;

    @BeforeEach
    void setup() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = user("sort-owner-", UserRole.ADMIN);

        upload("Alpha", "title-a.pdf");
        Thread.sleep(5);
        upload("Bravo", "title-b.pdf");
        Thread.sleep(5);
        upload("Charlie", "title-c.pdf");
    }

    @Test
    void sortByUploadedAtDesc_ordersByCreatedAtDescending() throws Exception {
        mvc.perform(get(BASE).param("sort", "uploadedAt,desc").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("Charlie"))
                .andExpect(jsonPath("$.data.items[2].name").value("Alpha"));
    }

    @Test
    void sortByUploadedAtAsc_ordersByCreatedAtAscending() throws Exception {
        mvc.perform(get(BASE).param("sort", "uploadedAt,asc").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("Alpha"))
                .andExpect(jsonPath("$.data.items[2].name").value("Charlie"));
    }

    @Test
    void sortByNameAsc_ordersByTitleAscending() throws Exception {
        mvc.perform(get(BASE).param("sort", "name,asc").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("Alpha"))
                .andExpect(jsonPath("$.data.items[1].name").value("Bravo"))
                .andExpect(jsonPath("$.data.items[2].name").value("Charlie"));
    }

    @Test
    void sortByNameDesc_ordersByTitleDescending() throws Exception {
        mvc.perform(get(BASE).param("sort", "name,desc").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("Charlie"))
                .andExpect(jsonPath("$.data.items[1].name").value("Bravo"))
                .andExpect(jsonPath("$.data.items[2].name").value("Alpha"));
    }

    @Test
    void sortByUnknownField_fallsBackSafelyInsteadOfFailing() throws Exception {
        mvc.perform(get(BASE).param("sort", "totallyUnknownField,desc").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("Charlie"))
                .andExpect(jsonPath("$.data.items[2].name").value("Alpha"));
    }

    // --- helpers ---------------------------------------------------------------------------

    private void upload(String name, String filename) throws Exception {
        mvc.perform(multipart(BASE)
                        .file(new MockMultipartFile("file", filename, "application/pdf", pdfBytes()))
                        .param("name", name)
                        .param("category", "other")
                        .with(as(owner)))
                .andExpect(status().isOk());
    }

    private static byte[] pdfBytes() {
        return "%PDF-1.4 sort test body".getBytes(StandardCharsets.UTF_8);
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
