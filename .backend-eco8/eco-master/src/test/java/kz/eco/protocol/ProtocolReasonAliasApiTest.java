package kz.eco.protocol;

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Audit finding: "reason"/"comment" field naming was inconsistent across workflow endpoints - some
 * read a raw "comment" key from a Map body while the frontend may send "reason". "reason" is now
 * the canonical field (ProtocolApiDtos.ReturnForRevisionRequest/CancelProtocolRequest/
 * ReplaceProtocolRequest), with "comment" still accepted via @JsonAlias so older frontend builds
 * keep working - this test drives the JSON body through Jackson (unlike the direct-service-call
 * tests in ProtocolVersionConflictTest) to actually exercise the alias. Supervisor-only requests
 * use the {@code .with(authentication(...))} RequestPostProcessor (same pattern already proven in
 * ProtocolSigningApiTest) rather than a bare SecurityContextHolder.setAuthentication() call, since
 * that's the reliable way to switch roles mid-test against the real Spring Security filter chain.
 */
@SpringBootTest
@Transactional
class ProtocolReasonAliasApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ProtocolAuditLogRepository auditLogRepository;
    @Autowired
    private ProtocolService protocolService;

    private MockMvc mockMvc;
    private String protocolId;
    private User supervisor;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        supervisor = new User();
        supervisor.setEmail("supervisor-" + System.nanoTime() + "@ecoprogress.kz");
        supervisor.setPasswordHash(passwordEncoder.encode("demo123"));
        supervisor.setName("Supervisor Tester");
        supervisor.setPosition("Директор");
        supervisor.setRole(UserRole.ADMIN);
        supervisor.setType(ClientType.staff);
        userRepository.save(supervisor);

        authenticateLabUser();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = com.jayway.jsonpath.JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.id");
        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk());
        // readyForApproval requires testingMethodDocument to be set (validateReadyForApproval) -
        // same fixture step ProtocolSigningApiTest uses.
        mockMvc.perform(patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testing\":{\"testingMethodDocument\":\"МУК 4.1.2468-09\"}}"))
                .andExpect(status().isOk());
    }

    private RequestPostProcessor asSupervisor() {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                supervisor, null, List.of(new SimpleGrantedAuthority("ROLE_" + supervisor.getRole().name())));
        return authentication(auth);
    }

    @Test
    void returnForRevision_acceptsLegacyCommentField_andStoresItAsTheReason() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/protocols/" + protocolId + "/return-for-revision")
                        .with(asSupervisor())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\": \"Старый формат поля\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("NEEDS_REVISION"));

        var history = auditLogRepository.findByProtocolIdOrderByCreatedAtDesc(Long.parseLong(protocolId));
        assertEquals("Старый формат поля", history.get(0).getComment());
    }

    @Test
    void returnForRevision_acceptsCanonicalReasonField() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/protocols/" + protocolId + "/return-for-revision")
                        .with(asSupervisor())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\": \"Новый формат поля\"}"))
                .andExpect(status().isOk());

        var history = auditLogRepository.findByProtocolIdOrderByCreatedAtDesc(Long.parseLong(protocolId));
        assertEquals("Новый формат поля", history.get(0).getComment());
    }

    @Test
    void cancel_acceptsLegacyCommentField_andStoresItAsTheReason() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/cancel")
                        .with(asSupervisor())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\": \"Клиент отменил\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        var history = auditLogRepository.findByProtocolIdOrderByCreatedAtDesc(Long.parseLong(protocolId));
        assertEquals("Клиент отменил", history.get(0).getComment());
    }

    @Test
    void replace_acceptsLegacyCommentField_forReason() throws Exception {
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/protocols/" + protocolId + "/approve")
                        .with(asSupervisor())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
        byte[] pdfBytes = protocolService.downloadPdf(Long.parseLong(protocolId), supervisor.getId()).inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        mockMvc.perform(post("/api/protocols/" + protocolId + "/sign")
                        .with(asSupervisor())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cmsSignatureBase64\": \"" + cms + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/protocols/" + protocolId + "/replace")
                        .with(asSupervisor())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\": \"Опечатка в номере\"}"))
                .andExpect(status().isOk());

        var history = auditLogRepository.findByProtocolIdOrderByCreatedAtDesc(Long.parseLong(protocolId));
        assertEquals("Опечатка в номере", history.get(0).getComment());
    }
}
