package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.common.exception.ConflictException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Covers the remaining "Протоколы" hardening items: availableActions (status+role+user aware,
 *  server-computed), refreshLaboratoryData's version check + stale-document invalidation. */
@SpringBootTest
@Transactional
class ProtocolWorkflowHardeningTest extends ProtocolApiTestSupport {

    @Autowired private WebApplicationContext context;
    @Autowired private ProtocolService protocolService;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolDocumentGenerationService documentService;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private kz.eco.company.CompanyMembershipRepository companyMembershipRepository;

    private MockMvc mockMvc;
    private String protocolId;

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
        protocolId = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
    }

    // ---- availableActions: status + role + current user -----------------------------------

    @Test
    void availableActions_reflectsStatusAndRole_forLaboratoryOnDraft() throws Exception {
        mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.edit").value(true))
                .andExpect(jsonPath("$.data.availableActions.sign").value(false))
                .andExpect(jsonPath("$.data.availableActions.approve").value(false))
                .andExpect(jsonPath("$.data.availableActions.sendToApproval").value(true));
    }

    /** Module fix item 5: the READY-based self-sign shortcut is retired - LABORATORY never gets
     *  canSign, even once the protocol reaches APPROVED; only a supervisor role does. */
    @Test
    void availableActions_neverAllowsLaboratoryToSign_evenOnceApproved() throws Exception {
        long id = Long.parseLong(protocolId);
        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        protocol.setStatus(ProtocolStatus.APPROVED);
        protocolRepository.saveAndFlush(protocol);

        mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.availableActions.sign").value(false))
                .andExpect(jsonPath("$.data.permissions.canSign").value(false));
    }

    @Test
    void availableActions_readOnlyRoleSeesOnlyView() throws Exception {
        User manager = new User();
        manager.setEmail("workflow-hardening-manager-" + System.nanoTime() + "@ecoprogress.kz");
        manager.setPasswordHash(passwordEncoder.encode("demo123"));
        manager.setName("Manager Tester");
        manager.setRole(UserRole.MANAGER);
        manager.setType(ClientType.staff);
        userRepository.save(manager);
        // P0 module fix item 2: PROTOCOL_VIEW alone no longer grants global read - a MANAGER needs
        // real company scope over this specific protocol to see it at all.
        kz.eco.company.CompanyMembership membership = new kz.eco.company.CompanyMembership();
        membership.setCompanyId(companyId);
        membership.setUserId(manager.getId());
        membership.setRoleCode(UserRole.MANAGER);
        membership.setStatus(kz.eco.company.CompanyMembershipStatus.ACTIVE);
        companyMembershipRepository.save(membership);

        mockMvc.perform(get("/api/protocols/" + protocolId).with(
                        org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication(
                                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                                        manager, null, java.util.List.of(
                                                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_MANAGER"))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.availableActions.view").value(true))
                .andExpect(jsonPath("$.data.availableActions.edit").value(false))
                .andExpect(jsonPath("$.data.availableActions.sign").value(false));
    }

    // ---- refreshLaboratoryData: version-checked + invalidates stale documents --------------

    @Test
    void refreshLaboratoryData_staleVersion_returns409() throws Exception {
        long id = Long.parseLong(protocolId);
        ConflictException ex = assertThrows(ConflictException.class,
                () -> protocolService.refreshLaboratoryData(id, 999L, labUser.getId()));
        assertEquals("OPTIMISTIC_LOCK_CONFLICT", ex.getCode());
    }

    @Test
    void refreshLaboratoryData_clearsStaleGeneratedDocuments() throws Exception {
        long id = Long.parseLong(protocolId);
        documentService.generatePdf(id, labUser.getId());
        Protocol before = protocolRepository.findById(id).orElseThrow();
        assertTrue(before.getPdfFileId() != null, "precondition: a PDF must already be generated");

        protocolService.refreshLaboratoryData(id, before.getVersion(), labUser.getId());

        Protocol after = protocolRepository.findById(id).orElseThrow();
        assertNull(after.getPdfFileId(), "refreshing laboratory data must invalidate the previously generated PDF");
    }
}
