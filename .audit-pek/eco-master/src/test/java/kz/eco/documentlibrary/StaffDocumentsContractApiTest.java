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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Covers the exact /api/staff/documents response envelope the frontend is already wired to
 *  (name/category/originalFileName/uploadedAt/uploadedBy{id,fullName}/downloadUrl/canDelete/
 *  availableActions), the permission-driven DOCUMENT_DELETE_FORBIDDEN code, and DELETE without a
 *  version param (the frontend sends no body at all). CrmDocumentApiTest already covers the
 *  broader CRUD/search/optimistic-locking/file-validation surface - not duplicated here. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class StaffDocumentsContractApiTest {

    private static final String BASE = "/api/staff/documents";

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;

    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void uploadResponse_matchesTheExactContractShape() throws Exception {
        User admin = user("contract-admin-", UserRole.ADMIN);
        MvcResult result = mvc.perform(multipart(BASE)
                        .file(new MockMultipartFile("file", "permit.pdf", "application/pdf", pdfBytes()))
                        .param("name", "Экологическое разрешение")
                        .param("category", "permit")
                        .param("comment", "Действующая версия")
                        .with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.name").value("Экологическое разрешение"))
                .andExpect(jsonPath("$.data.category").value("permit"))
                .andExpect(jsonPath("$.data.comment").value("Действующая версия"))
                .andExpect(jsonPath("$.data.originalFileName").value("permit.pdf"))
                .andExpect(jsonPath("$.data.mimeType").value("application/pdf"))
                .andExpect(jsonPath("$.data.fileSize").value(pdfBytes().length))
                .andExpect(jsonPath("$.data.uploadedAt").exists())
                .andExpect(jsonPath("$.data.uploadedBy.id").value(admin.getId().intValue()))
                .andExpect(jsonPath("$.data.uploadedBy.fullName").value(admin.getName()))
                .andExpect(jsonPath("$.data.canDelete").value(true))
                .andReturn();

        Long id = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
        String downloadUrl = JsonPath.read(result.getResponse().getContentAsString(), "$.data.downloadUrl");
        assertEquals(BASE + "/" + id + "/download", downloadUrl);
    }

    @Test
    void listResponse_includesAvailableActionsPerDocument() throws Exception {
        User owner = user("contract-list-", UserRole.ECOLOGIST);
        mvc.perform(multipart(BASE)
                        .file(new MockMultipartFile("file", "protocol.pdf", "application/pdf", pdfBytes()))
                        .param("name", "Протокол")
                        .param("category", "protocol")
                        .with(as(owner)))
                .andExpect(status().isOk());

        mvc.perform(get(BASE).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].availableActions[0]").value("DOWNLOAD"))
                .andExpect(jsonPath("$.data.items[0].availableActions", org.hamcrest.Matchers.hasItem("DELETE")));
    }

    @Test
    void download_returnsPdfContentTypeAndAttachmentDisposition() throws Exception {
        User u = user("contract-dl-", UserRole.MANAGER);
        Long id = upload(u, "report.pdf");

        mvc.perform(get(BASE + "/" + id + "/download").with(as(u)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentType("application/pdf"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Disposition", org.hamcrest.Matchers.containsString("report.pdf")));
    }

    /** Module fix item 1: version is now mandatory on DELETE - a request with no version at all
     *  is rejected before ever reaching the optimistic-lock/ownership checks. */
    @Test
    void delete_withoutVersionParam_isRejected() throws Exception {
        User u = user("contract-del-", UserRole.ECOLOGIST);
        Long id = upload(u, "to-delete.pdf");

        mvc.perform(delete(BASE + "/" + id).with(as(u)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void delete_withCorrectVersion_succeeds() throws Exception {
        User u = user("contract-del-ok-", UserRole.ECOLOGIST);
        Long id = upload(u, "to-delete.pdf");

        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").doesNotExist());

        mvc.perform(get(BASE).param("uploadedByUserId", String.valueOf(u.getId())).with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == " + id + ")]").isEmpty());
    }

    @Test
    void delete_withStaleVersion_returns409VersionConflict() throws Exception {
        User u = user("contract-del-stale-", UserRole.ECOLOGIST);
        Long id = upload(u, "to-delete.pdf");

        mvc.perform(delete(BASE + "/" + id).param("version", "99").with(as(u)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void delete_byNonOwnerNonElevatedStaff_returns403WithDocumentDeleteForbiddenCode() throws Exception {
        User owner = user("contract-forbid-owner-", UserRole.LABORATORY);
        User other = user("contract-forbid-other-", UserRole.ACCOUNTANT);
        Long id = upload(owner, "someones.pdf");

        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("DOCUMENT_DELETE_FORBIDDEN"))
                .andExpect(jsonPath("$.message").exists());
    }

    // ---- module fix items 3/4/5: archived documents are not directly reachable by ID ---------

    @Test
    void archivedDocument_directDownload_byNonOwnerNonElevatedStaff_returns404() throws Exception {
        User owner = user("contract-archdl-owner-", UserRole.LABORATORY);
        User other = user("contract-archdl-other-", UserRole.ACCOUNTANT);
        Long id = upload(owner, "to-archive-dl.pdf");
        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(owner)))
                .andExpect(status().isOk());

        mvc.perform(get(BASE + "/" + id + "/download").with(as(other)))
                .andExpect(status().isNotFound());
        mvc.perform(get(BASE + "/" + id).with(as(other)))
                .andExpect(status().isNotFound());
    }

    @Test
    void archivedDocument_directDownload_byOwner_stillWorks() throws Exception {
        User owner = user("contract-archdl-self-", UserRole.LABORATORY);
        Long id = upload(owner, "to-archive-dl-self.pdf");
        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(owner)))
                .andExpect(status().isOk());

        mvc.perform(get(BASE + "/" + id).with(as(owner)))
                .andExpect(status().isOk());
    }

    @Test
    void archivedDocument_directDownload_byAdmin_stillWorks() throws Exception {
        User owner = user("contract-archdl-owner2-", UserRole.LABORATORY);
        User admin = user("contract-archdl-admin-", UserRole.ADMIN);
        Long id = upload(owner, "to-archive-dl-admin.pdf");
        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(owner)))
                .andExpect(status().isOk());

        mvc.perform(get(BASE + "/" + id).with(as(admin)))
                .andExpect(status().isOk());
    }

    @Test
    void nonOwnerStaffSeesCanDeleteFalse_andNoDeleteInAvailableActions() throws Exception {
        User owner = user("contract-visibility-owner-", UserRole.LABORATORY);
        User other = user("contract-visibility-other-", UserRole.ACCOUNTANT);
        Long id = upload(owner, "visibility.pdf");

        mvc.perform(get(BASE + "/" + id).with(as(other)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canDelete").value(false))
                .andExpect(jsonPath("$.data.availableActions", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("DELETE"))));
    }

    @Test
    void disallowedExecutableFormat_isBlockedRegardlessOfDeclaredMimeType() throws Exception {
        User u = user("contract-exe-", UserRole.ADMIN);
        MockMultipartFile file = new MockMultipartFile(
                "file", "installer.exe", "application/pdf", "MZ fake exe body".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart(BASE).file(file).param("name", "x").param("category", "other").with(as(u)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    // --- helpers ---------------------------------------------------------------------------

    private Long upload(User as, String filename) throws Exception {
        String response = mvc.perform(multipart(BASE)
                        .file(new MockMultipartFile("file", filename, "application/pdf", pdfBytes()))
                        .param("name", filename)
                        .param("category", "other")
                        .with(as(as)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return Long.valueOf(JsonPath.read(response, "$.data.id").toString());
    }

    private static byte[] pdfBytes() {
        return "%PDF-1.4 staff documents contract test body".getBytes(StandardCharsets.UTF_8);
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
