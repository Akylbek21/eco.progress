package kz.eco.signaturedoc;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import kz.ecoprogress.documentflow.signing.TestCmsSigner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Module: simplified internal document signing (/api/staff/signature-documents), no
 *  organization/company/subscription dependency - visibility is own-documents-only, ADMIN sees
 *  all. Only 6 endpoints exist: upload, list, content, prepare-signing, submit-signature,
 *  signed-package - there is no GET /{id} or archive anymore, so access checks are exercised via
 *  GET /{id}/content (200 = visible, 404 = not). */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@Transactional
class SignatureDocumentApiTest {

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired SignatureDocumentRepository documents;
    @Autowired SignatureDocumentAuditLogRepository auditLogs;
    @Autowired kz.eco.storage.FileStorageService fileStorageService;

    MockMvc mvc;
    User owner;
    User otherUser;
    User admin;

    private static final String BASE = "/api/staff/signature-documents";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        owner = user("owner-", UserRole.ECOLOGIST);
        owner.setIin("990101300123");
        users.save(owner);
        otherUser = user("other-", UserRole.ECOLOGIST);
        admin = user("admin-", UserRole.ADMIN);
    }

    // --- upload -----------------------------------------------------------------------------

    @Test void uploadOfAllowedFileTypeSucceeds() throws Exception {
        mvc.perform(multipart(BASE).file(pdf("doc.pdf")).param("title", "My doc").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.originalFileName").value("doc.pdf"));
    }

    @Test void unsupportedFormatRejected() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "malware.exe", "application/octet-stream",
                "not really an exe".getBytes(StandardCharsets.UTF_8));
        mvc.perform(multipart(BASE).file(file).with(as(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
    }

    @Test void oversizedFileRejected() throws Exception {
        byte[] tooBig = new byte[26_214_401];
        System.arraycopy("%PDF-1.4".getBytes(StandardCharsets.UTF_8), 0, tooBig, 0, 8);
        MockMultipartFile file = new MockMultipartFile("file", "big.pdf", "application/pdf", tooBig);
        mvc.perform(multipart(BASE).file(file).with(as(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }

    @Test void uploadIsScopedToTheUploaderRegardlessOfAnyClientSuppliedData() throws Exception {
        String response = mvc.perform(multipart(BASE).file(pdf("doc.pdf")).with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Long id = extractId(response);
        SignatureDocument saved = documents.findById(id).orElseThrow();
        assertEquals(owner.getId(), saved.getCreatedByUserId());
    }

    @Test void identicalBytesSha256Stable() throws Exception {
        byte[] content = pdfBytes();
        MockMultipartFile f1 = new MockMultipartFile("file", "a.pdf", "application/pdf", content);
        MockMultipartFile f2 = new MockMultipartFile("file", "b.pdf", "application/pdf", content);
        String r1 = mvc.perform(multipart(BASE).file(f1).with(as(owner))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String r2 = mvc.perform(multipart(BASE).file(f2).with(as(owner))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        SignatureDocument d1 = documents.findById(extractId(r1)).orElseThrow();
        SignatureDocument d2 = documents.findById(extractId(r2)).orElseThrow();
        assertEquals(d1.getSha256(), d2.getSha256());
    }

    @Test void idempotentUploadDoesNotDuplicate() throws Exception {
        mvc.perform(multipart(BASE).file(pdf("doc.pdf")).with(as(owner)).header("Idempotency-Key", "up-1"))
                .andExpect(status().isOk());
        mvc.perform(multipart(BASE).file(pdf("doc.pdf")).with(as(owner)).header("Idempotency-Key", "up-1"))
                .andExpect(status().isOk());
        long count = documents.findAll().stream()
                .filter(d -> d.getCreatedByUserId().equals(owner.getId())).count();
        assertEquals(1, count);
    }

    // --- own-documents-only list + access control ----------------------------------------------

    @Test void listReturnsOnlyTheCallersOwnDocuments() throws Exception {
        uploadDocument(owner);
        uploadDocument(otherUser);
        mvc.perform(get(BASE).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].createdByUserId").value(owner.getId().intValue()));
    }

    @Test void otherUsersDocumentIsNotAccessible() throws Exception {
        Long id = uploadDocument(owner);
        mvc.perform(get(BASE + "/" + id + "/content").with(as(otherUser)))
                .andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(otherUser)))
                .andExpect(status().isNotFound());
    }

    @Test void adminSeesEveryonesDocumentsInListAndCanAccessThem() throws Exception {
        Long id = uploadDocument(owner);
        mvc.perform(get(BASE).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == " + id + ")]").exists());
        mvc.perform(get(BASE + "/" + id + "/content").with(as(admin)))
                .andExpect(status().isOk());
    }

    /** P0 module fix item 7: ADMIN's extended VIEW access (adminSeesEveryonesDocumentsInListAndCanAccessThem
     *  above) must never extend to SIGN - only the document's own owner may ever sign it, even an
     *  ADMIN who can otherwise open/download it. */
    @Test void adminCannotSignAnotherUsersDocument_evenThoughAdminCanViewIt() throws Exception {
        Long id = uploadDocument(owner);
        mvc.perform(get(BASE + "/" + id + "/content").with(as(admin)))
                .andExpect(status().isOk());

        mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(admin)))
                .andExpect(status().isForbidden());
    }

    @Test void nonSignRoleForbiddenToSign() throws Exception {
        // CLIENT role has none of the SIGNATURE_DOCUMENT_* roles.
        User client = user("client-", UserRole.CLIENT);
        Long id = uploadDocument(owner);
        mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(client)))
                .andExpect(status().isForbidden());
    }

    // --- signing -------------------------------------------------------------------------------

    @Test void validCmsSignsSuccessfullyEndToEnd() throws Exception {
        Long id = uploadDocument(owner);
        String prepare = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepare, "signingSessionId");
        String sha256 = extractString(prepare, "sha256");
        long version = Long.parseLong(extractString(prepare, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin());

        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verificationStatus").value("VERIFIED"));

        assertEquals(SignatureDocumentStatus.SIGNED, documents.findById(id).orElseThrow().getStatus());
    }

    @Test void signedDocumentCannotBeResigned() throws Exception {
        Long id = uploadDocument(owner);
        signSuccessfully(id);
        mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENT_ALREADY_SIGNED"));
    }

    @Test void invalidCorruptCmsRejectedWithoutPersistingSignedState() throws Exception {
        Long id = uploadDocument(owner);
        String prepare = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepare, "signingSessionId");
        String sha256 = extractString(prepare, "sha256");
        long version = Long.parseLong(extractString(prepare, "version"));
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"bm90IGEgcmVhbCBjbXM="}
                """.formatted(sessionId, id, version, sha256);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CMS_SIGNATURE"));
        assertEquals(SignatureDocumentStatus.AWAITING_SIGNATURE, documents.findById(id).orElseThrow().getStatus());
    }

    @Test void cmsForDifferentBytesRejectedAsHashMismatch() throws Exception {
        Long id = uploadDocument(owner);
        String prepare = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepare, "signingSessionId");
        String sha256 = extractString(prepare, "sha256");
        long version = Long.parseLong(extractString(prepare, "version"));
        String cmsForOtherBytes = TestCmsSigner.signAttached("completely different content".getBytes(StandardCharsets.UTF_8), owner.getIin());
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cmsForOtherBytes);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SIGNATURE_VERIFICATION_FAILED"));
    }

    @Test void expiredSigningSessionRejected() throws Exception {
        Long id = uploadDocument(owner);
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));

        SignatureDocumentSigningSessionRepository sessionRepository =
                context.getBean(SignatureDocumentSigningSessionRepository.class);
        var session = sessionRepository.findById(sessionId).orElseThrow();
        session.setExpiresAt(java.time.LocalDateTime.now().minusMinutes(1));
        sessionRepository.save(session);

        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin());
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SIGNING_SESSION_EXPIRED"));
    }

    @Test void versionConflictRejected() throws Exception {
        Long id = uploadDocument(owner);
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin());
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":99,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENT_VERSION_CONFLICT"));
    }

    @Test void expiredCertificateRejected() throws Exception {
        Long id = uploadDocument(owner);
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin(),
                new Date(System.currentTimeMillis() - 20L * 86_400_000L),
                new Date(System.currentTimeMillis() - 10L * 86_400_000L));
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_EXPIRED"));
    }

    @Test void iinMismatchRejected_certificateProfileNotLinkedWhenUserHasNoIin() throws Exception {
        User noIin = user("noiin-", UserRole.ECOLOGIST);
        Long id = uploadDocument(noIin);
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(noIin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), "990101300123");
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(noIin))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_PROFILE_NOT_LINKED"));
    }

    @Test void iinMismatch_ownerMismatchWhenCertIinDiffersFromLinkedIin() throws Exception {
        Long id = uploadDocument(owner); // owner.iin = 990101300123
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), "800101300456");
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_OWNER_MISMATCH"));
    }

    /** Module spec item 6: the cert's subject serial number commonly carries an "IIN" prefix -
     *  this must still match after normalization. */
    @Test void ceritficateIinWithPrefixStillMatchesAfterNormalization() throws Exception {
        Long id = uploadDocument(owner);
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), "IIN 990101300123");
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verificationStatus").value("VERIFIED"));
    }

    @Test void idempotentSignDoesNotDuplicate() throws Exception {
        Long id = uploadDocument(owner);
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin());
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner)).header("Idempotency-Key", "sign-1")
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isOk());
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner)).header("Idempotency-Key", "sign-1")
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isOk());
        var signatureRepo = context.getBean(SignatureDocumentSignatureRepository.class);
        assertEquals(1, signatureRepo.findByDocumentIdOrderByCreatedAtDesc(id).size());
    }

    // --- companyId / headers ---------------------------------------------------------------------

    /** Module spec: no organization/company tenant scoping - companyId must never be required by
     *  the upload endpoint, and the persisted row must accept a null companyId cleanly (verifies
     *  the V88/V90 migrations actually left the column nullable). */
    @Test void uploadDoesNotRequireCompanyIdAndPersistsWithNullCompanyId() throws Exception {
        Long id = uploadDocument(owner);
        SignatureDocument saved = documents.findById(id).orElseThrow();
        assertNull(saved.getCompanyId());
    }

    @Test void contentEndpointReturnsOriginalFilenameInContentDisposition() throws Exception {
        Long id = uploadDocument(owner);
        mvc.perform(get(BASE + "/" + id + "/content").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/pdf")))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("filename=\"doc.pdf\"")))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("filename*=UTF-8''doc.pdf")));
    }

    @Test void unauthenticatedRequest_returns401() throws Exception {
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/1/content")).andExpect(status().isUnauthorized());
    }

    @Test void content_whenUnderlyingFileMissing_returns404NotServerError() throws Exception {
        Long id = uploadDocument(owner);
        SignatureDocument document = documents.findById(id).orElseThrow();
        fileStorageService.delete(document.getStorageFileId());

        mvc.perform(get(BASE + "/" + id + "/content").with(as(owner)))
                .andExpect(status().isNotFound());
    }

    @Test void signedPackageReturnsZipFilenameInContentDisposition() throws Exception {
        Long id = uploadDocument(owner);
        signSuccessfully(id);
        mvc.perform(get(BASE + "/" + id + "/signed-package").with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(".zip")));
    }

    // --- package / audit -----------------------------------------------------------------------

    @Test void zipPackageContainsExpectedEntries() throws Exception {
        Long id = uploadDocument(owner);
        signSuccessfully(id);
        var asyncResult = mvc.perform(get(BASE + "/" + id + "/signed-package").with(as(owner)))
                .andExpect(request().asyncStarted()).andReturn();
        byte[] zipBytes = mvc.perform(asyncDispatch(asyncResult))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        java.util.Set<String> names = new java.util.HashSet<>();
        try (var zip = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipBytes))) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                names.add(entry.getName());
                if (entry.getName().equals("signature-info.json")) {
                    String json = new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                    assertTrue(json.contains("\"documentId\""));
                    assertTrue(json.contains("\"sha256\""));
                    // Nothing is configured in tests (no trust store/CRL/OCSP endpoint) - every
                    // check must honestly report NOT_CONFIGURED, never a faked "passed".
                    assertTrue(json.contains("\"chainStatus\":\"NOT_CONFIGURED\""));
                    assertTrue(json.contains("\"crlStatus\":\"NOT_CONFIGURED\""));
                    assertTrue(json.contains("\"ocspStatus\":\"NOT_CONFIGURED\""));
                    assertTrue(json.contains("\"tsaStatus\":\"NOT_PROVIDED\""));
                }
            }
        }
        assertTrue(names.contains("doc.pdf"));
        assertTrue(names.contains("doc.pdf.p7s"));
        assertTrue(names.contains("signature-info.json"));
    }

    @Test void auditLogEntriesCreatedForKeyActions() throws Exception {
        Long id = uploadDocument(owner);
        signSuccessfully(id);
        List<SignatureDocumentAuditLog> logs = auditLogs.findByDocumentIdOrderByTimestampDesc(id);
        List<String> actions = logs.stream().map(SignatureDocumentAuditLog::getAction).toList();
        assertTrue(actions.contains("UPLOAD"));
        assertTrue(actions.contains("PREPARE_SIGNING"));
        assertTrue(actions.contains("SIGN_SUCCESS"));
    }

    // --- helpers ---------------------------------------------------------------------------

    private void signSuccessfully(Long id) throws Exception {
        String prepareBody = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = extractString(prepareBody, "signingSessionId");
        String sha256 = extractString(prepareBody, "sha256");
        long version = Long.parseLong(extractString(prepareBody, "version"));
        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin());
        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);
        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isOk());
    }

    private Long uploadDocument(User as) throws Exception {
        String response = mvc.perform(multipart(BASE).file(pdf("doc.pdf")).with(as(as)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return extractId(response);
    }

    private static byte[] pdfBytes() {
        return "%PDF-1.4 test document body".getBytes(StandardCharsets.UTF_8);
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
