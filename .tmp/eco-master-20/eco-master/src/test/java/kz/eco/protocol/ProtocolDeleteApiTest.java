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
 * DELETE /api/protocols/{id}?version={version} - available to every LAB_PROTOCOL role (ADMIN/
 * DIRECTOR/HEAD/LABORATORY). An empty DRAFT (no results) is physically removed; a filled,
 * unsigned, unpublished protocol is soft-deleted (deletedAt set, hidden from GET /api/protocols,
 * kept for history); a signed or published protocol (or one in a terminal CANCELLED/REPLACED/
 * ARCHIVED state, reachable via POST /{id}/archive or /{id}/cancel instead) returns 409. version
 * is optimistic-lock checked like every other mutating protocol endpoint. See
 * Protocol.isDeletable() for the exact rule, shared with ProtocolPermissionService.canDelete.
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
        adminUser.setIin("990101300123");
        userRepository.save(adminUser);

        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        addResultViaDraftBatch(mockMvc, protocolId, 0);
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
    void delete_allowedForLaboratoryRole_softDeletesFilledDraft() throws Exception {
        Long id = Long.parseLong(protocolId);
        Long version = protocolRepository.findById(id).orElseThrow().getVersion();
        // Still authenticated as LABORATORY from setUp() - DELETE is open to every LAB_PROTOCOL role.
        mockMvc.perform(delete("/api/protocols/" + protocolId).param("version", version.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        Protocol softDeleted = protocolRepository.findById(id).orElseThrow();
        assertNotNull(softDeleted.getDeletedAt(), "filled unsigned draft must be soft-deleted, not rejected");
        assertEquals(ProtocolStatus.DRAFT, softDeleted.getStatus(), "soft delete must not change status");
    }

    @Test
    void delete_draftWithResults_softDeletesAndHidesFromList() throws Exception {
        Long id = Long.parseLong(protocolId);
        Long version = protocolRepository.findById(id).orElseThrow().getVersion();

        mockMvc.perform(delete("/api/protocols/" + protocolId).param("version", version.toString()).with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        Protocol softDeleted = protocolRepository.findById(id).orElseThrow();
        assertEquals(ProtocolStatus.DRAFT, softDeleted.getStatus());
        assertNotNull(softDeleted.getDeletedAt(), "filled draft delete must set deletedAt, not remove the row");
        assertFalse(resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty(),
                "protocol_results must not be touched by a soft delete");

        mockMvc.perform(get("/api/protocols").with(asAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id == " + id + ")]").isEmpty());
    }

    @Test
    void delete_withStaleVersion_returns409() throws Exception {
        mockMvc.perform(delete("/api/protocols/" + protocolId)
                        .param("version", "999999")
                        .with(asAdmin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        Protocol untouched = protocolRepository.findById(Long.parseLong(protocolId)).orElseThrow();
        assertNull(untouched.getDeletedAt(), "a version-mismatched delete must not touch the row");
    }

    @Test
    void delete_emptyDraftByAdmin_physicallyRemovesIt() throws Exception {
        Long id = Long.parseLong(protocolId);
        for (var result : resultRepository.findByProtocolIdOrderByRowNumberAsc(id)) {
            resultRepository.delete(result);
        }
        Long version = protocolRepository.findById(id).orElseThrow().getVersion();

        mockMvc.perform(delete("/api/protocols/" + protocolId).param("version", version.toString()).with(asAdmin()))
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
        Long v0 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.update(id, fullUpdate(v0), labUser.getId());
        Long v1 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.readyForApproval(id, v1, labUser.getId());
        Long v2 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.approve(id, v2, labUser.getId());
        byte[] pdfBytes = protocolService.downloadPdf(id, labUser.getId()).inputStream().readAllBytes();
        Long v3 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.sign(id, new ProtocolApiDtos.SignProtocolRequest(TestCmsSigner.signAttached(pdfBytes), v3), adminUser.getId());
        Long v4 = protocolRepository.findById(id).orElseThrow().getVersion();

        mockMvc.perform(delete("/api/protocols/" + protocolId).param("version", v4.toString()).with(asAdmin()))
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

        Long v0 = protocolRepository.findById(id).orElseThrow().getVersion();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/cancel").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + v0 + ", \"reason\": \"Аннулирован в тесте\"}"))
                .andExpect(status().isOk());
        Long v1 = protocolRepository.findById(id).orElseThrow().getVersion();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/archive").with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + v1 + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        Protocol archived = protocolRepository.findById(id).orElseThrow();
        assertEquals(ProtocolStatus.ARCHIVED, archived.getStatus());
        assertNotNull(archived.getDeletedAt());
        assertFalse(resultRepository.findByProtocolIdOrderByRowNumberAsc(id).isEmpty(),
                "protocol_results must not be physically deleted by archive");
    }

    private static ProtocolApiDtos.UpdateProtocolRequest fullUpdate(Long version) {
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
                null,
                null,
                version
        );
    }
}
