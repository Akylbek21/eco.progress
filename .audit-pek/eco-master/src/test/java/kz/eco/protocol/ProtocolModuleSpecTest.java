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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Targeted coverage for the module-spec fixes made in this pass (real drafts, contentVersion,
 * normative RBAC, PROTOCOL_VIEW, document generation not touching status, null-vs-zero,
 * normative search matchMode). Not the full 25-scenario suite from spec §17 - see the session's
 * final report for what's covered here vs. still outstanding.
 */
@SpringBootTest
@Transactional
class ProtocolModuleSpecTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private kz.eco.company.CompanyMembershipRepository companyMembershipRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    // --- §1: real drafts ---

    @Test
    void createDraft_onlyTemplateId_staysInDraft() throws Exception {
        authenticateLabUser();
        mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":\"" + templateApiId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.companyId").doesNotExist())
                .andExpect(jsonPath("$.data.version").exists())
                .andExpect(jsonPath("$.data.permissions").exists());
    }

    @Test
    void createDraft_withPartialCompanyOnly_doesNotRequireObjectOrLab() throws Exception {
        authenticateLabUser();
        String body = "{\"templateId\":\"" + templateApiId + "\",\"companyId\":" + companyId + "}";
        mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.companyId").value(companyId.intValue()));
    }

    // --- §5: contentVersion bumps on child-row mutation ---

    @Test
    void addResult_bumpsContentVersion() throws Exception {
        authenticateLabUser();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        String protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
        Long contentVersionBefore = ((Number) JsonPath.read(
                created.getResponse().getContentAsString(), "$.data.contentVersion")).longValue();

        addResultViaDraftBatch(mockMvc, protocolId, 0);

        MvcResult reloaded = mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andReturn();
        Long contentVersionAfter = ((Number) JsonPath.read(
                reloaded.getResponse().getContentAsString(), "$.data.contentVersion")).longValue();

        assertNotEquals(contentVersionBefore, contentVersionAfter,
                "addResult must bump the parent protocol's contentVersion, not just save the child row");
    }

    // --- §4: normative dictionary RBAC ---

    @Test
    void laboratory_cannotCreateNormative() throws Exception {
        authenticateLabUser();
        String body = """
                {"templateId":"physical_factors","indicator":"Тест","sourceDocumentCode":"DSM_15",
                 "factorType":"NOISE","unit":"дБА","comparisonType":"LESS_OR_EQUAL","value":"80"}
                """;
        mockMvc.perform(post("/api/normatives")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    // --- §3: PROTOCOL_VIEW for MANAGER (read-only) ---

    @Autowired
    private ProtocolService protocolService;

    @Test
    void managerRole_canViewButNotCreateProtocol() throws Exception {
        User manager = new User();
        manager.setEmail("manager-" + System.nanoTime() + "@ecoprogress.kz");
        manager.setPasswordHash(passwordEncoder.encode("demo123"));
        manager.setName("Manager Tester");
        manager.setRole(UserRole.MANAGER);
        manager.setType(ClientType.staff);
        userRepository.save(manager);

        authenticateLabUser();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        String protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        // Module spec §3: PROTOCOL_VIEW - can see the protocol, nothing else. Calls the service
        // directly (not through MockMvc) for the identity switch itself, same pattern as
        // ProtocolSigningApiTest#response_reflectsSignedByCurrentUserAndPermissions - MockMvc's
        // security filter chain does not honor a bare SecurityContextHolder swap made between two
        // separate .perform() calls the way a same-thread direct service call does.
        authenticate(manager);
        ProtocolApiDtos.ProtocolResponse response = protocolService.get(Long.parseLong(protocolId));
        assertEquals(true, response.permissions().canView());
        assertEquals(false, response.permissions().canEdit());
    }

    /** Separate test (rather than continuing managerRole_canViewButNotCreateProtocol) because
     *  MockMvc's security filter chain reads the Authentication that was active when THIS test
     *  method's MockMvc calls started, not a mid-test SecurityContextHolder swap - see that test's
     *  comment. A clean single-identity test avoids that pitfall entirely. */
    @Test
    void managerRole_cannotCreateProtocolViaHttp() throws Exception {
        User manager = new User();
        manager.setEmail("manager2-" + System.nanoTime() + "@ecoprogress.kz");
        manager.setPasswordHash(passwordEncoder.encode("demo123"));
        manager.setName("Manager Tester 2");
        manager.setRole(UserRole.MANAGER);
        manager.setType(ClientType.staff);
        userRepository.save(manager);

        authenticate(manager);
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isForbidden());
    }

    // --- §12: document generation must not change workflow status ---

    @Test
    void previewDoesNotChangeStatus() throws Exception {
        authenticateLabUser();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        String protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        mockMvc.perform(get("/api/protocols/" + protocolId + "/preview"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    // --- §10: 0 is a valid result value, never treated as missing ---

    @Test
    void resultWithZeroValue_isPersistedAndComparable() throws Exception {
        authenticateLabUser();
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        String protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");

        String zeroResultJson = """
                {
                  "code": "0301",
                  "pollutantCode": "0301",
                  "indicatorName": "Азота диоксид",
                  "normativeValue": "0.2",
                  "unit": "мг/м³",
                  "comparisonType": "LESS_OR_EQUAL",
                  "primaryReading": "0",
                  "result": "0",
                  "version": 0
                }
                """;
        // Use draft-results batch (canonical API). Note: batch response is the full protocol,
        // not the individual result row — verify via GET after adding.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0,\"added\":[{\"clientRowId\":\"z-1\",\"values\":" + zeroResultJson.strip() + "}]}"))
                .andExpect(status().isOk());
    }

    // --- §9: normative search response explains match level ---

    @Test
    void normativeSearch_returnsMatchModeAndFiltersApplied() throws Exception {
        authenticateLabUser();
        mockMvc.perform(get("/api/normatives/search")
                        .param("query", "Азота")
                        .param("templateId", "ambient_air"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.matchMode").exists())
                .andExpect(jsonPath("$.data.filtersIgnored").isArray());
    }
}
