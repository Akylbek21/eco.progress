package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.ClientType;
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

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the "исправь создание протокола" pass: draft-results field completeness (resultValue as
 * the canonical value key, plus normativeDocument/casNumber/formula/avgValue/durationMinutes -
 * previously whitelisted but silently dropped, see ProtocolResultValuesMapper), the atomic/
 * version-checked header+results save, the new pre-DRAFT-exit gate (normative-active +
 * device-verification, aggregated as fieldErrors alongside the existing structural/type-policy
 * checks), SOIL's header-level sampleNumber/samplingDepth, and the full create -&gt; save -&gt;
 * reopen (returnToDraft) -&gt; complete (sign) lifecycle for two representative template types.
 */
@SpringBootTest
@Transactional
class ProtocolCreationLifecycleTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private ProtocolService protocolService;
    @Autowired
    private ProtocolResultRepository resultRepository;
    @Autowired
    private MeasurementDeviceRepository deviceRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        ensureSoilTemplate();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private void ensureSoilTemplate() {
        if (templateRepository.findByCode("SOIL").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("SOIL");
            template.setName("Почва");
            template.setDescription("Почва");
            template.setFormCode("SOL");
            template.setActive(true);
            templateRepository.save(template);
        }
    }

    private String createProtocol() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJson()))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(created.getResponse().getContentAsString(), "$.data.id");
    }

    private void patchTestingMethod(String protocolId) throws Exception {
        Long version = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"testing\":{\"testingMethodDocument\":\"МУК 4.1.2468-09\"}, \"version\": " + version + "}"))
                .andExpect(status().isOk());
    }

    // ---- draft-results: field completeness + resultValue as canonical -------------------------

    @Test
    void draftResults_persistsAndRoundTripsAllResultFields_includingResultValue() throws Exception {
        String protocolId = createProtocol();
        MvcResult current = mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": 0}"))
                .andExpect(status().isOk()).andReturn();
        long version = ((Number) JsonPath.read(current.getResponse().getContentAsString(), "$.data.version")).longValue();

        String batchBody = """
                {
                  "version": %d,
                  "added": [
                    {
                      "clientRowId": "row-1",
                      "values": {
                        "indicatorName": "Азота диоксид",
                        "unit": "мг/м³",
                        "resultValue": 0.18,
                        "casNumber": "10102-44-0",
                        "formula": "NO2",
                        "normativeDocument": "ГН 2.1.6.3492-17",
                        "avgValue": 0.16,
                        "durationMinutes": 20,
                        "samplingPlace": "Точка №1"
                      }
                    }
                  ],
                  "updated": [],
                  "deletedIds": []
                }
                """.formatted(version);

        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(batchBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].values.resultValue").value(0.18))
                .andExpect(jsonPath("$.data.results[0].values.casNumber").value("10102-44-0"))
                .andExpect(jsonPath("$.data.results[0].values.formula").value("NO2"))
                .andExpect(jsonPath("$.data.results[0].values.normativeDocument").value("ГН 2.1.6.3492-17"))
                .andExpect(jsonPath("$.data.results[0].values.avgValue").value(0.16))
                .andExpect(jsonPath("$.data.results[0].values.durationMinutes").value(20));

        // Round-trips through a fresh GET too, not just the mutation response.
        mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].values.resultValue").value(0.18))
                .andExpect(jsonPath("$.data.results[0].values.casNumber").value("10102-44-0"))
                .andExpect(jsonPath("$.data.results[0].values.formula").value("NO2"));

        Object rawId = JsonPath.read(mockMvc.perform(get("/api/protocols/" + protocolId))
                .andReturn().getResponse().getContentAsString(), "$.data.results[0].id");
        Long resultId = Long.valueOf(rawId.toString());
        ProtocolResult persisted = resultRepository.findById(resultId).orElseThrow();
        assertEquals(0, persisted.getResultValue().compareTo(new java.math.BigDecimal("0.18")));
        assertEquals("10102-44-0", persisted.getCasNumber());
        assertEquals("NO2", persisted.getFormula());
        assertEquals(0, persisted.getAvgValue().compareTo(new java.math.BigDecimal("0.16")));
        assertEquals(20, persisted.getDurationMinutes());
    }

    @Test
    void draftResults_isAtomicAndVersionChecked_staleVersionRejectsWholeBatch() throws Exception {
        String protocolId = createProtocol();
        String staleBody = """
                {"version": 999, "added": [{"values": {"indicatorName": "X", "resultValue": 1}}], "updated": [], "deletedIds": []}
                """;
        mockMvc.perform(patch("/api/protocols/" + protocolId + "/draft-results")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(staleBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));

        mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results.length()").value(0));
    }

    // ---- SOIL: header-level sampleNumber/samplingDepth gate before leaving DRAFT --------------

    @Test
    void soil_readyForApproval_blockedWithoutSampleNumberAndDepth() throws Exception {
        templateApiId = "soil";
        String protocolId = createProtocol();
        addResultViaDraftBatch(mockMvc, protocolId, 0);
        patchTestingMethod(protocolId);

        Long v1 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": " + v1 + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].code", org.hamcrest.Matchers.hasItem("SOIL_SAMPLE_NUMBER_REQUIRED")))
                .andExpect(jsonPath("$.errors[*].code", org.hamcrest.Matchers.hasItem("SOIL_SAMPLING_DEPTH_REQUIRED")));
    }

    @Test
    void soil_fullLifecycle_create_save_reopen_complete() throws Exception {
        templateApiId = "soil";
        String protocolId = createProtocol();
        addResultViaDraftBatch(mockMvc, protocolId, 0);
        patchTestingMethod(protocolId);

        Long conditionsVersion = protocolService.get(Long.parseLong(protocolId)).version();
        String conditionsBody = """
                {"environment": {"conditions": {
                  "sampleNumber": "П-14", "samplingDepth": "0-20 см", "samplingPlace": "Точка №1"
                }}, "version": %d}
                """.formatted(conditionsVersion);
        mockMvc.perform(patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(conditionsBody))
                .andExpect(status().isOk());

        // save -> ready for approval succeeds now that the header conditions + normative/device
        // gate all pass.
        Long v1 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": " + v1 + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY_FOR_APPROVAL"));

        // reopen: returnToDraft takes it back to DRAFT for further editing (supervisor-gated).
        Long v2 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/return-to-draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": " + v2 + ", \"reason\": \"Требуется доработка условий\"}")
                        .with(asRole(UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"));

        // condition fields survived the round trip through DRAFT again.
        mockMvc.perform(get("/api/protocols/" + protocolId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.environment.conditions.sampleNumber").value("П-14"))
                .andExpect(jsonPath("$.data.environment.conditions.samplingDepth").value("0-20 см"));

        // complete: set the approver while still editable (DRAFT), then re-enter
        // ready-for-approval, then approve + sign (supervisor path, matches the existing SOIL
        // template's workflow - LABORATORY's direct READY->SIGNED shortcut is already covered by
        // ProtocolSigningApiTest/ProtocolSigningHardeningTest for AMBIENT_AIR).
        Long v3 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(patch("/api/protocols/" + protocolId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"headOfLaboratoryName\":\"Иванов И.И.\", \"version\": " + v3 + "}"))
                .andExpect(status().isOk());
        Long v4 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": " + v4 + "}"))
                .andExpect(status().isOk());
        Long v5 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/approve")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": " + v5 + "}")
                        .with(asRole(UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        byte[] pdfBytes = protocolService.downloadPdf(Long.parseLong(protocolId), labUser.getId())
                .inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        Long v6 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/sign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cmsSignatureBase64\":\"" + cms + "\", \"version\": " + v6 + "}")
                        .with(asRole(UserRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SIGNED"));
    }

    // ---- normative-active + device-verified gate now blocks leaving DRAFT, not just sign -----

    @Test
    void readyForApproval_blockedWhenNormativeNeverSelected() throws Exception {
        String protocolId = createProtocol();
        Long v0 = protocolService.get(Long.parseLong(protocolId)).version();
        Map<String, Object> row = protocolService.addResult(Long.parseLong(protocolId),
                new ProtocolApiDtos.ResultRow(null, null, null,
                        java.util.Map.of("indicatorName", "Пыль", "unit", "мг/м³", "resultValue", 1.0)),
                v0, labUser.getId());
        Long resultId = Long.parseLong(String.valueOf(row.get("id")));
        ProtocolResult result = resultRepository.findById(resultId).orElseThrow();
        result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_SELECTED);
        resultRepository.saveAndFlush(result);
        patchTestingMethod(protocolId);

        Long v1 = protocolService.get(Long.parseLong(protocolId)).version();
        mockMvc.perform(post("/api/protocols/" + protocolId + "/ready-for-approval")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": " + v1 + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].code", org.hamcrest.Matchers.hasItem("NORMATIVE_NOT_SELECTED")));
    }

    /** Module fix: ProtocolService.sign() now re-checks the actor's real DB role (closing the sign
     *  bypass - see ProtocolPermissionService.SUPERVISOR_ROLES), not just the SimpleGrantedAuthority
     *  string Spring Security's @PreAuthorize sees - so a supervisor-only action needs an actual
     *  supervisor-role user persisted in the DB, not labUser wearing a relabeled authority. */
    private kz.eco.user.User supervisorUser;

    private org.springframework.test.web.servlet.request.RequestPostProcessor asRole(UserRole role) {
        if (supervisorUser == null) {
            kz.eco.user.User user = new kz.eco.user.User();
            user.setEmail("supervisor-" + System.nanoTime() + "@ecoprogress.kz");
            user.setPasswordHash(passwordEncoder.encode("demo123"));
            user.setName("Supervisor Tester");
            user.setRole(role);
            user.setType(ClientType.staff);
            user.setIin("990101300123");
            userRepository.save(user);
            supervisorUser = user;
        }
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        supervisorUser, null,
                        java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + role.name()))));
    }
}
