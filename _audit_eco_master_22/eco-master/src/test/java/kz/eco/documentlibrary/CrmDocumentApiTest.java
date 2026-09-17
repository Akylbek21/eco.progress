package kz.eco.documentlibrary;

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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** CRM document library (kz.eco.documentlibrary) API tests. Deliberately standalone module -
 *  no orders/protocols/PEK/document-flow involved anywhere in setup or assertions. */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class CrmDocumentApiTest {

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired CrmDocumentRepository documents;

    MockMvc mvc;

    private static final String BASE = "/api/staff/documents";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    // --- upload / download across staff roles ------------------------------------------------

    @Test void everyStaffRoleCanUploadAndDownload() throws Exception {
        for (UserRole role : UserRole.staffRoles()) {
            User u = user("staff-" + role.name() + "-", role);
            byte[] bytes = pdfBytes();
            String response = mvc.perform(multipart(BASE)
                            .file(new MockMultipartFile("file", "doc.pdf", "application/pdf", bytes))
                            .param("name","Doc for " + role)
                            .param("category", "CONTRACT")
                            .with(as(u)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            Long id = extractId(response);

            byte[] downloaded = mvc.perform(get(BASE + "/" + id + "/download").with(as(u)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsByteArray();
            assertArrayEquals(bytes, downloaded, "downloaded bytes must exactly match uploaded bytes for role " + role);
        }
    }

    @Test void downloadedBytesMatchUploadedExactly() throws Exception {
        byte[] bytes = pdfBytes();
        User u = user("bytes-", UserRole.ECOLOGIST);
        Long id = upload(u, "doc.pdf", "application/pdf", bytes, "CONTRACT");
        byte[] downloaded = mvc.perform(get(BASE + "/" + id + "/download").with(as(u)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(bytes, downloaded);
    }

    @Test void uploadDoesNotRequireOrderId() throws Exception {
        // No orderId param exists on this endpoint at all - just confirm upload succeeds without it.
        User u = user("noorder-", UserRole.MANAGER);
        mvc.perform(multipart(BASE).file(pdf("doc.pdf")).param("name","T").param("category", "OTHER")
                        .with(as(u)))
                .andExpect(status().isOk());
    }

    @Test void persistedRowHasNoForeignKeyToOrdersStructurally() throws Exception {
        // Structural check: the migration defines no column or FK referencing an orders table
        // (comments mentioning "orders" to document the design intent are fine - only actual
        // schema references matter here).
        String migration = Files.readString(Path.of("src/main/resources/db/migration/V83__crm_document_library.sql")).toLowerCase();
        assertFalse(migration.contains("order_id"), "migration must not define an order_id column");
        assertFalse(migration.contains("references orders"), "migration must not FK-reference the orders table");
        String entity = Files.readString(Path.of("src/main/java/kz/eco/documentlibrary/CrmDocument.java"));
        assertFalse(entity.toLowerCase().contains("orderid"), "entity must not have an orderId field");
    }

    // --- access control ------------------------------------------------------------------------

    @Test void clientRoleForbiddenOnEveryEndpoint() throws Exception {
        User owner = user("owner-", UserRole.ECOLOGIST);
        Long id = upload(owner, "doc.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        User client = user("client-", UserRole.CLIENT);

        mvc.perform(get(BASE).with(as(client))).andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/categories").with(as(client))).andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/" + id).with(as(client))).andExpect(status().isForbidden());
        mvc.perform(multipart(BASE).file(pdf("x.pdf")).param("name","t").param("category", "OTHER")
                        .with(as(client))).andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/" + id + "/download").with(as(client))).andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/" + id + "/preview").with(as(client))).andExpect(status().isForbidden());
        mvc.perform(patch(BASE + "/" + id).with(as(client)).contentType("application/json")
                        .content("{\"name\":\"x\",\"version\":0}")).andExpect(status().isForbidden());
        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(client))).andExpect(status().isForbidden());
    }

    @Test void nonOwnerNonElevatedStaffCannotPatchOrArchiveOthersDocument() throws Exception {
        User owner = user("owner2-", UserRole.ECOLOGIST);
        User other = user("other2-", UserRole.MANAGER);
        Long id = upload(owner, "doc.pdf", "application/pdf", pdfBytes(), "CONTRACT");

        mvc.perform(patch(BASE + "/" + id).with(as(other)).contentType("application/json")
                        .content("{\"name\":\"hacked\",\"version\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CRM_DOCUMENT_ACCESS_DENIED"));

        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DOCUMENT_DELETE_FORBIDDEN"));
    }

    @Test void adminAndDirectorCanArchiveOthersDocument() throws Exception {
        User owner = user("owner3-", UserRole.ECOLOGIST);
        User admin = user("admin3-", UserRole.ADMIN);
        User director = user("dir3-", UserRole.DIRECTOR);

        Long id1 = upload(owner, "doc1.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        mvc.perform(delete(BASE + "/" + id1).param("version", "0").with(as(admin)))
                .andExpect(status().isOk());

        Long id2 = upload(owner, "doc2.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        mvc.perform(delete(BASE + "/" + id2).param("version", "0").with(as(director)))
                .andExpect(status().isOk());
    }

    @Test void ownerCanPatchOwnDocument() throws Exception {
        User owner = user("owner4-", UserRole.LABORATORY);
        Long id = upload(owner, "doc.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        mvc.perform(patch(BASE + "/" + id).with(as(owner)).contentType("application/json")
                        .content("{\"name\":\"Renamed\",\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Renamed"));
    }

    // --- optimistic locking ---------------------------------------------------------------------

    @Test void staleVersionOnPatchReturnsVersionConflict() throws Exception {
        User owner = user("owner5-", UserRole.ECOLOGIST);
        Long id = upload(owner, "doc.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        mvc.perform(patch(BASE + "/" + id).with(as(owner)).contentType("application/json")
                        .content("{\"name\":\"stale\",\"version\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test void staleVersionOnArchiveReturnsVersionConflict() throws Exception {
        User owner = user("owner6-", UserRole.ECOLOGIST);
        Long id = upload(owner, "doc.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        mvc.perform(delete(BASE + "/" + id).param("version", "99").with(as(owner)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    // --- validation ------------------------------------------------------------------------------

    @Test void disallowedFileTypeRejected() throws Exception {
        User u = user("badtype-", UserRole.ECOLOGIST);
        MockMultipartFile file = new MockMultipartFile("file", "malware.exe", "application/octet-stream",
                "not really an exe".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart(BASE).file(file).param("name","t").param("category", "OTHER").with(as(u)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CRM_DOCUMENT_FILE_TYPE_NOT_ALLOWED"));
    }

    // --- search / filters --------------------------------------------------------------------

    @Test void filterByCategoryReturnsOnlyMatching() throws Exception {
        User u = user("cat-", UserRole.ACCOUNTANT);
        upload(u, "a.pdf", "application/pdf", pdfBytes(), "CONTRACT");
        upload(u, "b.pdf", "application/pdf", pdfBytes(), "INVOICE");

        mvc.perform(get(BASE).param("category", "CONTRACT").with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].category", org.hamcrest.Matchers.everyItem(
                        org.hamcrest.Matchers.equalTo("CONTRACT"))));
    }

    @Test void searchByTitleAndByOriginalFilename() throws Exception {
        User u = user("search-", UserRole.WASTE_SPECIALIST);
        upload(u, "annual-report.pdf", "application/pdf", pdfBytes(), "REPORT", "Годовой отчёт компании");
        upload(u, "invoice-99.pdf", "application/pdf", pdfBytes(), "INVOICE", "Другой документ");

        mvc.perform(get(BASE).param("q", "Годовой").with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].originalFileName").value("annual-report.pdf"));

        mvc.perform(get(BASE).param("q", "invoice-99").with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].originalFileName").value("invoice-99.pdf"));
    }

    @Test void filterByDateRangeAndUploadedByUserId() throws Exception {
        User u1 = user("date1-", UserRole.HEAD);
        User u2 = user("date2-", UserRole.HEAD);
        Long inRange = uploadWithDate(u1, "in-range.pdf", java.time.LocalDate.of(2026, 3, 15));
        uploadWithDate(u1, "out-of-range.pdf", java.time.LocalDate.of(2020, 1, 1));
        uploadWithDate(u2, "other-user.pdf", java.time.LocalDate.of(2026, 3, 15));

        mvc.perform(get(BASE).param("dateFrom", "2026-01-01").param("dateTo", "2026-12-31")
                        .param("uploadedByUserId", String.valueOf(u1.getId())).with(as(u1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(inRange));
    }

    @Test void paginationBehavesCorrectlyAcrossMultiplePages() throws Exception {
        User u = user("page-", UserRole.MANAGER);
        for (int i = 0; i < 5; i++) {
            upload(u, "p" + i + ".pdf", "application/pdf", pdfBytes(), "OTHER");
        }
        String page0 = mvc.perform(get(BASE).param("page", "0").param("size", "2")
                        .param("uploadedByUserId", String.valueOf(u.getId())).with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(2))
                .andExpect(jsonPath("$.data.totalElements").value(5))
                .andExpect(jsonPath("$.data.totalPages").value(3))
                .andReturn().getResponse().getContentAsString();
        assertNotNull(page0);

        mvc.perform(get(BASE).param("page", "2").param("size", "2")
                        .param("uploadedByUserId", String.valueOf(u.getId())).with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.last").value(true));
    }

    @Test void archivedDocumentNotInDefaultList() throws Exception {
        User u = user("arch-", UserRole.ECOLOGIST);
        Long id = upload(u, "to-archive.pdf", "application/pdf", pdfBytes(), "OTHER");
        mvc.perform(delete(BASE + "/" + id).param("version", "0").with(as(u))).andExpect(status().isOk());

        mvc.perform(get(BASE).param("uploadedByUserId", String.valueOf(u.getId())).with(as(u)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == " + id + ")]").isEmpty());
    }

    // --- helpers ---------------------------------------------------------------------------

    private Long upload(User as, String filename, String contentType, byte[] bytes, String category) throws Exception {
        return upload(as, filename, contentType, bytes, category, null);
    }

    private Long upload(User as, String filename, String contentType, byte[] bytes, String category, String comment) throws Exception {
        var request = multipart(BASE)
                .file(new MockMultipartFile("file", filename, contentType, bytes))
                .param("name",filename)
                .param("category", category)
                .with(as(as));
        if (comment != null) {
            request = request.param("comment", comment);
        }
        String response = mvc.perform(request).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return extractId(response);
    }

    private Long uploadWithDate(User as, String filename, java.time.LocalDate date) throws Exception {
        String response = mvc.perform(multipart(BASE)
                        .file(new MockMultipartFile("file", filename, "application/pdf", pdfBytes()))
                        .param("name",filename).param("category", "OTHER")
                        .param("documentDate", date.toString())
                        .with(as(as)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return extractId(response);
    }

    private static byte[] pdfBytes() {
        return "%PDF-1.4 test document body for CRM document library".getBytes(StandardCharsets.UTF_8);
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

    private static Long extractId(String json) {
        return Long.valueOf(extractString(json, "id"));
    }

    private static String extractString(String json, String field) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"" + field + "\":\"?([^,\"}]+)\"?").matcher(json);
        if (!m.find()) throw new IllegalStateException("Field not found: " + field + " in " + json);
        return m.group(1);
    }
}
