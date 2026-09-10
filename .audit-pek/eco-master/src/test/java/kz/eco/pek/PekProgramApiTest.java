package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Coverage for PekProgramService's ID-preserving aggregate reconciliation (module spec §4): the
 * previous implementation deleted every control item/indicator/measure on every PATCH and
 * reinserted them with brand-new identities, silently orphaning anything that referenced the old
 * ids from outside the aggregate (PekReportProtocolSource.controlItemId in particular). These
 * tests prove ids survive an edit, additions/removals are diffed correctly, a foreign/unknown id
 * is rejected rather than silently accepted, and a control item already matched by a report's
 * collected protocols cannot be deleted out from under that report.
 */
@SpringBootTest
@Transactional
class PekProgramApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long actorUserId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО PEK Reconcile Test");
        company.setBin("990011223344");
        company.setLegalAddress("г. Алматы, ул. Тестовая, 5");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Площадка №1");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        User head = new User();
        head.setEmail("pek-reconcile-" + System.nanoTime() + "@ecoprogress.kz");
        head.setPasswordHash(passwordEncoder.encode("demo123"));
        head.setName("Head Tester");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);
        actorUserId = head.getId();

        // Iteration 1 tenant isolation: HEAD is not a global-access role, needs an ACTIVE
        // PekStaffAssignment in this test's company or every endpoint call below would 403.
        PekStaffAssignment membership = new PekStaffAssignment();
        membership.setCompanyId(companyId);
        membership.setUserId(head.getId());
        membership.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        membership.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(membership);

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                head, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private Long createProgramWithOneControlItem() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-RECON-1", "name": "Программа реконсиляции",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31",
                 "controlItems": [
                   {"code": "CI-1", "name": "Источник №1", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(companyId, objectId);
        MvcResult result = mockMvc.perform(post("/api/pek/programs")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    @Test
    void editingControlItemById_preservesIdentity_insteadOfRecreating() throws Exception {
        Long programId = createProgramWithOneControlItem();
        List<PekProgramControlItem> before = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        assertEquals(1, before.size());
        Long originalId = before.get(0).getId();

        String editJson = """
                {"controlItems": [
                   {"id": %d, "code": "CI-1", "name": "Источник №1 (переименован)", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(originalId);
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(editJson))
                .andExpect(status().isOk());

        List<PekProgramControlItem> after = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        assertEquals(1, after.size());
        assertEquals(originalId, after.get(0).getId(), "editing by id must keep the same row identity");
        assertEquals("Источник №1 (переименован)", after.get(0).getName());
    }

    @Test
    void addingControlItemViaEdit_appendsWithoutDisturbingExistingIds() throws Exception {
        Long programId = createProgramWithOneControlItem();
        Long originalId = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId();

        String editJson = """
                {"controlItems": [
                   {"id": %d, "code": "CI-1", "name": "Источник №1", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1},
                   {"code": "CI-2", "name": "Источник №2", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(originalId);
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(editJson))
                .andExpect(status().isOk());

        List<PekProgramControlItem> after = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        assertEquals(2, after.size());
        assertEquals(originalId, after.get(0).getId(), "the pre-existing row must not be recreated");
        assertNotEquals(originalId, after.get(1).getId());
    }

    @Test
    void omittingControlItemFromEdit_deletesOnlyThatRow() throws Exception {
        Long programId = createProgramWithOneControlItem();
        Long originalId = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId();

        // Add a second item first so we can prove removal is selective, not a full wipe.
        String addSecond = """
                {"controlItems": [
                   {"id": %d, "code": "CI-1", "name": "Источник №1", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1},
                   {"code": "CI-2", "name": "Источник №2", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(originalId);
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(addSecond))
                .andExpect(status().isOk());
        Long secondId = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).stream()
                .filter(i -> !i.getId().equals(originalId)).findFirst().orElseThrow().getId();

        // Now omit CI-1 entirely - only it should be deleted.
        String removeFirst = """
                {"controlItems": [
                   {"id": %d, "code": "CI-2", "name": "Источник №2", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """.formatted(secondId);
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON).content(removeFirst))
                .andExpect(status().isOk());

        List<PekProgramControlItem> after = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId);
        assertEquals(1, after.size());
        assertEquals(secondId, after.get(0).getId());
    }

    @Test
    void editWithForeignControlItemId_isRejected() throws Exception {
        Long programId = createProgramWithOneControlItem();

        String editJson = """
                {"controlItems": [
                   {"id": 999999999, "code": "CI-1", "name": "Источник №1", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1}
                 ]}
                """;
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(editJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_FOREIGN_CHILD_ID"));
    }

    @Test
    void deletingControlItemAlreadyMatchedByReport_isBlocked() throws Exception {
        Long programId = createProgramWithOneControlItem();
        Long controlItemId = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId();

        // Simulate a report having already collected a protocol result against this control item -
        // exactly the external reference the old delete-all/insert-all silently orphaned.
        ProtocolTemplate template = templateRepository.findByCode("RECON_TEST_TEMPLATE").orElseGet(() -> {
            ProtocolTemplate t = new ProtocolTemplate();
            t.setCode("RECON_TEST_TEMPLATE");
            t.setName("Reconciliation test template");
            t.setDescription("Reconciliation test template");
            t.setFormCode("TEST");
            t.setActive(true);
            return templateRepository.save(t);
        });
        Protocol protocol = new Protocol();
        protocol.setCompanyId(companyId);
        protocol.setObjectId(objectId);
        protocol.setTemplateId(template.getId());
        protocol.setProtocolNumber("RECON-TEST-1");
        protocol.setProtocolDate(java.time.LocalDate.now());
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocol.setCreatedBy(actorUserId);
        protocolRepository.save(protocol);

        PekReportProtocolSource source = new PekReportProtocolSource();
        source.setReportId(1L);
        source.setProgramId(programId);
        source.setProtocolId(protocol.getId());
        source.setControlItemId(controlItemId);
        source.setMatchStatus(PekMatchStatus.MATCHED);
        source.setMatchedAt(LocalDateTime.now());
        sourceRepository.save(source);

        String removeJson = """
                {"controlItems": []}
                """;
        mockMvc.perform(patch("/api/pek/programs/" + programId).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(removeJson))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_CONTROL_ITEM_IN_USE"));

        // And the row must genuinely still be there, not deleted-then-rolled-back-in-a-confusing-way.
        assertEquals(1, controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).size());
    }
}
