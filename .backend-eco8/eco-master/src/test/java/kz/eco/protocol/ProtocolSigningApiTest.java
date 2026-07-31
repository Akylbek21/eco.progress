package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Multi-signature model: up to ProtocolSigningProperties.maxSignatures (5) different internal
 * employees can each sign the same protocol version once via POST /{id}/sign - the first
 * transitions APPROVED -> SIGNED, the rest are additional signatures recorded while status stays
 * SIGNED (see ProtocolService#sign).
 */
@SpringBootTest
@Transactional
class ProtocolSigningApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ProtocolService protocolService;

    @Autowired
    private ProtocolSignatureRepository signatureRepository;

    private MockMvc mockMvc;
    private Long protocolId;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testing\":{\"testingMethodDocument\":\"МУК 4.1.2468-09\"}}"))
                .andExpect(status().isOk());

        protocolService.readyForApproval(protocolId, labUser.getId());
        protocolService.approve(protocolId, labUser.getId());
    }

    private RequestPostProcessor asRole(User user, UserRole role) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
        return authentication(auth);
    }

    private User newSupervisor(String suffix, UserRole role) {
        User user = new User();
        user.setEmail("signer-" + suffix + "-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Signer " + suffix);
        user.setPosition("Директор");
        user.setRole(role);
        user.setType(ClientType.staff);
        userRepository.save(user);
        return user;
    }

    private MvcResult signAs(User user, UserRole role) throws Exception {
        byte[] pdfBytes = protocolService.downloadPdf(protocolId, labUser.getId()).inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        String body = "{\"cmsSignatureBase64\":\"" + cms + "\"}";
        return mockMvc.perform(post("/api/protocols/" + protocolId + "/sign")
                        .with(asRole(user, role))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn();
    }

    @Test
    void firstSignature_transitionsToSigned() throws Exception {
        User admin = newSupervisor("first", UserRole.ADMIN);
        MvcResult result = signAs(admin, UserRole.ADMIN);
        assertEquals(200, result.getResponse().getStatus());
        String body = result.getResponse().getContentAsString();
        assertEquals("SIGNED", JsonPath.read(body, "$.data.status"));
        assertEquals(1, ((Number) JsonPath.read(body, "$.data.signatureCount")).intValue());
        assertEquals(5, ((Number) JsonPath.read(body, "$.data.maxSignatures")).intValue());
    }

    @Test
    void secondDifferentSigner_staysSigned_countIncreases() throws Exception {
        User first = newSupervisor("a", UserRole.ADMIN);
        User second = newSupervisor("b", UserRole.HEAD);
        signAs(first, UserRole.ADMIN);

        MvcResult result = signAs(second, UserRole.HEAD);
        assertEquals(200, result.getResponse().getStatus());
        String body = result.getResponse().getContentAsString();
        assertEquals("SIGNED", JsonPath.read(body, "$.data.status"));
        assertEquals(2, ((Number) JsonPath.read(body, "$.data.signatureCount")).intValue());
    }

    @Test
    void sameUser_signingTwice_returns409() throws Exception {
        User admin = newSupervisor("dup", UserRole.ADMIN);
        signAs(admin, UserRole.ADMIN);

        MvcResult result = signAs(admin, UserRole.ADMIN);
        assertEquals(409, result.getResponse().getStatus());
        assertEquals("PROTOCOL_ALREADY_SIGNED", JsonPath.read(result.getResponse().getContentAsString(), "$.code"));
    }

    @Test
    void sixthSigner_returns409SignatureLimitReached() throws Exception {
        for (int i = 0; i < 5; i++) {
            User signer = newSupervisor("limit" + i, UserRole.ADMIN);
            MvcResult r = signAs(signer, UserRole.ADMIN);
            assertEquals(200, r.getResponse().getStatus(), "signer " + i + " should succeed");
        }
        User sixth = newSupervisor("limit5", UserRole.ADMIN);
        MvcResult result = signAs(sixth, UserRole.ADMIN);
        assertEquals(409, result.getResponse().getStatus());
        assertEquals("SIGNATURE_LIMIT_REACHED", JsonPath.read(result.getResponse().getContentAsString(), "$.code"));
    }

    @Test
    void laboratoryRole_cannotSign() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/sign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cmsSignatureBase64\":\"irrelevant\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void response_reflectsSignedByCurrentUserAndPermissions() throws Exception {
        User admin = newSupervisor("perm", UserRole.ADMIN);
        signAs(admin, UserRole.ADMIN);

        authenticate(admin);
        ProtocolApiDtos.ProtocolResponse response = protocolService.get(protocolId);
        assertFalse(response.permissions().canEdit(), "SIGNED protocols must not be editable");
        assertEquals(1, response.signatureCount());
        assertTrue(response.signedByCurrentUser(), "admin already signed - signedByCurrentUser must be true");
        assertFalse(response.permissions().canSign(), "admin already signed this version - canSign must be false");
        assertEquals(1L, signatureRepository.countByProtocolIdAndProtocolVersion(protocolId, response.version()));

        User another = newSupervisor("perm2", UserRole.HEAD);
        authenticate(another);
        ProtocolApiDtos.ProtocolResponse responseForOther = protocolService.get(protocolId);
        assertFalse(responseForOther.signedByCurrentUser());
        assertTrue(responseForOther.permissions().canSign(), "a different supervisor who hasn't signed yet must still be able to");
    }
}
