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

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * DELETE /api/protocols/{id} is now a true physical delete (ADMIN-only, empty DRAFT only) instead
 * of the old "soft-archive any non-signed/non-replaced protocol" behavior - see
 * ProtocolService.delete(). The old soft-archive-and-keep-results behavior these tests used to
 * cover now lives at POST /{id}/archive (reachable from CANCELLED/REPLACED per the canonical
 * status workflow), exercised here via archive_cancelledProtocol_softArchivesAndKeepsResults.
 */
@SpringBootTest
@Transactional
class ProtocolDeleteApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ProtocolService protocolService;

    @Autowired
    private ProtocolRepository protocolRepository;

    @Autowired
    private ProtocolResultRepository resultRepository;

    private MockMvc mockMvc;
    private String protocolId;
    private User adminUser;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        adminUser = new User();
        adminUser.setEmail("protocol-admin-" + System.nanoTime() + "@ecoprogress.kz");
        adminUser.setPasswordHash(passwordEncoder.encode("demo123"));
        adminUser.setName("Protocol Admin");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setType(ClientType.staff);
        userRepository.save(adminUser);

        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        mockMvc.perform(post("/api/protocols/" + protocolId + "/results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(normalResultJson()))
                .andExpect(status().isOk());
    }

    /** Attaches adminUser's authentication directly to a single request via a
     *  RequestPostProcessor, instead of relying on the ambient SecurityContextHolder value - the
     *  ambient-ThreadLocal approach (see ProtocolApiTestSupport#authenticate) only reliably
     *  reflects the FIRST authentication set in a test; switching to a second user mid-test (as
     *  every admin-only case here needs, after setUp()'s LABORATORY-authenticated fixture calls)
     *  was silently evaluated as anonymous and got rejected with a misleading 403. Per-request
     *  RequestPostProcessors bypass that entirely and are the documented-reliable way to vary the
     *  principal across requests within one test. */
    private RequestPostProcessor asAdmin() {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                adminUser, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return authentication(auth);
    }

    @Test
    void delete_forbiddenForLaboratoryRole() throws Exception {
        // Still authenticated as LABORATORY from setUp() - DELETE is ADMIN-only now.
        mockMvc.perform(delete("/api/protocols/" + protocolId))
                .andExpect(status().isForbidden());
    }

    @Test
    void delete_draftWithResults_returns409AndKeepsProtocol() throws Exception {
        Long id = Long.parseLong(protocolId);

        mockMvc.perform(delete("/api/protocols/" + protocolId).with(asAdmin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("PROTOCOL_NOT_DELETABLE"));

        Protocol stillThere = protocolRepository.findById(id).orElseThrow();
        assertEquals(ProtocolStatus.DRAFT, stillThere.getStatus());
        assertFalse(resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty(),
                "protocol_results must not be touched by a rejected delete");
    }

    @Test
    void delete_emptyDraftByAdmin_physicallyRemovesIt() throws Exception {
        Long id = Long.parseLong(protocolId);
        for (var result : resultRepository.findByProtocolIdOrderByRowNumberAsc(id)) {
            resultRepository.delete(result);
        }

        mockMvc.perform(delete("/api/protocols/" + protocolId).with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertTrue(protocolRepository.findById(id).isEmpty(), "empty draft must be physically gone");
    }

    @Test
    void delete_nonExistentProtocol_returns404() throws Exception {
        mockMvc.perform(delete("/api/protocols/999999999").with(asAdmin()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Протокол не найден: 999999999"));
    }

    @Test
    void delete_signedProtocol_returns409AndLeavesItSigned() throws Exception {
        Long id = Long.parseLong(protocolId);
        protocolService.update(id, fullUpdate(), labUser.getId());
        protocolService.readyForApproval(id, labUser.getId());
        protocolService.approve(id, labUser.getId());
        byte[] pdfBytes = protocolService.downloadPdf(id, labUser.getId()).inputStream().readAllBytes();
        protocolService.sign(id, new ProtocolApiDtos.SignProtocolRequest(TestCmsSigner.signAttached(pdfBytes)), labUser.getId());

        mockMvc.perform(delete("/api/protocols/" + protocolId).with(asAdmin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("PROTOCOL_NOT_DELETABLE"));

        Protocol stillSigned = protocolRepository.findById(id).orElseThrow();
        assertEquals(ProtocolStatus.SIGNED, stillSigned.getStatus());
        assertNull(stillSigned.getDeletedAt());
    }

    @Test
    void archive_cancelledProtocol_softArchivesAndKeepsResults() throws Exception {
        Long id = Long.parseLong(protocolId);
        assertFalse(resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty(),
                "precondition: protocol has a result row");

        mockMvc.perform(post("/api/protocols/" + protocolId + "/cancel").with(asAdmin()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/protocols/" + protocolId + "/archive").with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        Protocol archived = protocolRepository.findById(id).orElseThrow();
        assertEquals(ProtocolStatus.ARCHIVED, archived.getStatus());
        assertNotNull(archived.getDeletedAt());
        assertFalse(resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty(),
                "protocol_results must not be physically deleted by archive");
    }

    private static ProtocolApiDtos.UpdateProtocolRequest fullUpdate() {
        return new ProtocolApiDtos.UpdateProtocolRequest(
                null,
                LocalDate.now().toString(),
                null,
                "Исполнитель",
                null,
                "Зав. лаб.",
                new ProtocolApiDtos.LaboratoryData(
                        null, null,
                        "Лаборатория", "Лаборатория",
                        null, null,
                        "Адрес", "Адрес",
                        null, null,
                        "KZ.А.123",
                        null,
                        LocalDate.now().plusYears(1).toString(),
                        null,
                        "Директор", "Директор",
                        null,
                        "Зав. лаб.", "Зав. лаб.",
                        null, null, "Исполнитель",
                        null, null, null
                ),
                new ProtocolApiDtos.OrganizationData(
                        "ТОО Protocol Test", "Адрес", "Объект", "Продукция", "Договор"
                ),
                new ProtocolApiDtos.TestingData(
                        "НД прод", "НД отбор", "НД испыт",
                        LocalDate.now().minusDays(2).toString(),
                        LocalDate.now().minusDays(1).toString(),
                        "Контроль", "20°C", null
                ),
                null,
                null,
                List.of(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }
}
