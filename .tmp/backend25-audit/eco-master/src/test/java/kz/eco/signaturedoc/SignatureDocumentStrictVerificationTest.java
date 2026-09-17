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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static com.jayway.jsonpath.JsonPath.read;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P0/P1 module fix items 1/4/5: with eco.signature.strict-verification-required=true (the new
 * production default), a signature whose trust chain/CRL/OCSP status cannot be established (no
 * trust store/CRL/OCSP configured in this test environment - NOT_CONFIGURED, never an explicit
 * revoked result) must fail-closed rather than being silently accepted, and the persisted
 * verification status must be the distinct TRUST_NOT_VERIFIED value - never mislabeled as
 * CERTIFICATE_REVOKED (item 5).
 */
@SpringBootTest(classes = kz.eco.EcoApplication.class)
@TestPropertySource(properties = "eco.signature.strict-verification-required=true")
@Transactional
class SignatureDocumentStrictVerificationTest {

    @Autowired WebApplicationContext context;
    @Autowired UserRepository users;
    @Autowired SignatureDocumentRepository documents;
    @Autowired SignatureDocumentSignatureRepository signatures;

    MockMvc mvc;
    User owner;

    private static final String BASE = "/api/staff/signature-documents";

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = new User();
        owner.setEmail("strict-" + System.nanoTime() + "@test.kz");
        owner.setPasswordHash("test");
        owner.setName("Strict Tester");
        owner.setRole(UserRole.ECOLOGIST);
        owner.setType(ClientType.staff);
        owner.setIin("990101300123");
        owner = users.save(owner);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    private byte[] pdfBytes() {
        return "%PDF-1.4 strict verification test content".getBytes(StandardCharsets.UTF_8);
    }

    private Long uploadDocument() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "strict.pdf", "application/pdf", pdfBytes());
        String response = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .multipart(BASE).file(file).param("title", "Strict").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) read(response, "$.data.id")).longValue();
    }

    @Test
    void signWithUnverifiableTrustChain_isRejectedFailClosed_andStatusIsTrustNotVerifiedNotRevoked() throws Exception {
        Long id = uploadDocument();
        String prepare = mvc.perform(post(BASE + "/" + id + "/prepare-signing").with(as(owner)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String sessionId = read(prepare, "$.data.signingSessionId");
        String sha256 = read(prepare, "$.data.sha256");
        long version = ((Number) read(prepare, "$.data.version")).longValue();
        String cms = TestCmsSigner.signAttached(pdfBytes(), owner.getIin());

        String submitBody = """
                {"signingSessionId":"%s","documentId":%d,"version":%d,"sha256":"%s","cmsBase64":"%s"}
                """.formatted(sessionId, id, version, sha256, cms);

        mvc.perform(post(BASE + "/" + id + "/signatures").with(as(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_TRUST_NOT_VERIFIED"));

        // The document must NOT have transitioned to SIGNED - a fail-closed rejection never
        // accepts the signature.
        assertEquals(SignatureDocumentStatus.AWAITING_SIGNATURE, documents.findById(id).orElseThrow().getStatus());

        SignatureDocumentSignature persisted = signatures.findByDocumentIdOrderByCreatedAtDesc(id).get(0);
        assertEquals(SignatureDocumentVerificationStatus.TRUST_NOT_VERIFIED, persisted.getVerificationStatus());
    }
}
