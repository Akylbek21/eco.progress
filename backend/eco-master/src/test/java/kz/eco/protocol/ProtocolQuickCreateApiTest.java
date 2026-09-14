package kz.eco.protocol;

import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.normative.EnvironmentType;
import kz.eco.normative.NormativeRecord;
import kz.eco.normative.NormativeRecordRepository;
import kz.eco.normative.PhysicalFactorExcelImportService;
import kz.eco.normative.TemplateType;
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

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolQuickCreateApiTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private PhysicalFactorExcelImportService physicalFactorImportService;

    @Autowired
    private MeasurementDeviceRepository deviceRepository;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    @Autowired
    private ProtocolResultRepository protocolResultRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() throws Exception {
        seedProtocolFixtures();
        authenticateLabUser();
        physicalFactorImportService.importResources();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private MeasurementDevice createDevice(LocalDate verificationValidUntil) {
        MeasurementDevice device = new MeasurementDevice();
        device.setName("Газоанализатор ГАНК-4");
        device.setModel("ГАНК-4");
        device.setSerialNumber("12547");
        device.setVerificationCertificateNumber("№ 4521");
        device.setVerificationDate(LocalDate.of(2026, 1, 10));
        device.setVerificationValidUntil(verificationValidUntil);
        return deviceRepository.save(device);
    }

    @Test
    void quickCreate_acceptsMeasurementDeviceId_andReturnsDeviceSummary() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "measurementDeviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].measurementDeviceId").value(String.valueOf(device.getId())))
                .andExpect(jsonPath("$.data.results[0].measurementDevice.name").value("Газоанализатор ГАНК-4"))
                .andExpect(jsonPath("$.data.results[0].measurementDevice.serialNumber").value("12547"));
    }

    @Test
    void quickCreate_acceptsDeviceIdFallback_whenMeasurementDeviceIdAbsent() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "deviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].measurementDeviceId").value(String.valueOf(device.getId())));
    }

    @Test
    void quickCreate_acceptsMeasurementDeviceIdInsideValues_asLastFallback() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "values": { "measurementDeviceId": %d }
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].measurementDeviceId").value(String.valueOf(device.getId())));
    }

    @Test
    void quickCreate_archivedDevice_returns400() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));
        device.setStatus(MeasurementDeviceStatus.ARCHIVED);
        deviceRepository.save(device);

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "measurementDeviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    void quickCreate_expiredVerification_returns400() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.of(2026, 6, 1));

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "measurementDeviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    @Test
    void quickCreate_withPrintVisibility_persistsCanonicalKeysInResponse() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "printVisibility": { "testBasis": false, "windSpeed": false },
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "measurementDeviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.printVisibility.testBasis").value(false))
                .andExpect(jsonPath("$.data.printVisibility.windSpeed").value(false))
                .andExpect(jsonPath("$.data.printVisibility.organizationName").value(true));
    }

    @Test
    void quickCreate_withLegacyPrintVisibilityAlias_isAcceptedAndNormalizedToCanonicalKey() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));

        // "testingBasis" is the pre-existing frontend alias for the canonical "testBasis" field -
        // see ProtocolApiDtos.ProtocolPrintVisibility's @JsonAlias annotations.
        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "printVisibility": { "testingBasis": false },
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "measurementDeviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                // the response must only ever emit the canonical key, never the alias
                .andExpect(jsonPath("$.data.printVisibility.testBasis").value(false))
                .andExpect(jsonPath("$.data.printVisibility.testingBasis").doesNotExist());
    }

    @Test
    void quickCreate_acceptsLaboratoryAndExecutorIds() throws Exception {
        templateApiId = "microclimate";
        ensureMicroclimateTemplate();

        Laboratory altLab = new Laboratory();
        altLab.setName("Alt Laboratory");
        altLab.setLegalName("ТОО Alt Laboratory");
        altLab.setAddress("г. Астана");
        altLab.setAccreditationNumber("KZ.ALT.001");
        altLab.setAccreditationIssuedAt(java.time.LocalDate.of(2021, 1, 1));
        altLab.setAccreditationValidUntil(java.time.LocalDate.of(2031, 1, 1));
        altLab.setDirectorName("Alt Director");
        altLab.setLaboratoryHeadName("Alt Head");
        altLab.setDefault(false);
        altLab.setActive(true);
        altLab = laboratoryRepository.save(altLab);

        LaboratoryEmployee altExecutor = new LaboratoryEmployee();
        altExecutor.setLaboratoryId(altLab.getId());
        altExecutor.setUserId(labUser.getId());
        altExecutor.setFullName("Alt Executor");
        altExecutor.setEmail("alt-exec@test.kz");
        altExecutor.setPosition("Исполнитель");
        altExecutor.setRole("EXECUTOR");
        altExecutor.setActive(true);
        altExecutor = laboratoryEmployeeRepository.save(altExecutor);

        String json = """
                {
                  "templateId": "microclimate",
                  "subtype": "MICROCLIMATE",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-01",
                  "measurementDate": "2026-07-01",
                  "measurementPlace": "Цех",
                  "conditions": {
                    "season": "COLD",
                    "workCategory": "IA",
                    "workplaceType": "PERMANENT",
                    "roomType": "PRODUCTION",
                    "normLevel": "OPTIMAL"
                  },
                  "measurements": [
                    {
                      "factorType": "MICROCLIMATE",
                      "factorCode": "AIR_TEMPERATURE",
                      "indicatorName": "Температура воздуха",
                      "value": 23.5,
                      "unit": "°C"
                    }
                  ]
                }
                """.formatted(companyId, objectId, altLab.getId(), altExecutor.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(altLab.getId().intValue()))
                .andExpect(jsonPath("$.data.laboratory.executorId").value(altExecutor.getId().intValue()));
    }

    @Test
    void quickCreate_microclimate_returnsFullProtocolWithResults() throws Exception {
        templateApiId = "microclimate";
        ensureMicroclimateTemplate();

        String json = """
                {
                  "templateId": "microclimate",
                  "subtype": "MICROCLIMATE",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-01",
                  "measurementDate": "2026-07-01",
                  "measurementTime": "10:30",
                  "measurementPlace": "Производственный цех",
                  "conditions": {
                    "season": "COLD",
                    "workCategory": "IA",
                    "workplaceType": "PERMANENT",
                    "roomType": "PRODUCTION",
                    "normLevel": "OPTIMAL"
                  },
                  "measurements": [
                    {
                      "factorType": "MICROCLIMATE",
                      "factorCode": "AIR_TEMPERATURE",
                      "indicatorName": "Температура воздуха",
                      "value": 23.5,
                      "unit": "°C"
                    },
                    {
                      "factorType": "MICROCLIMATE",
                      "factorCode": "HUMIDITY",
                      "indicatorName": "Относительная влажность",
                      "value": 55,
                      "unit": "%%"
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId);

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists())
                // Module spec §1: quick-create must never auto-promote past DRAFT or run
                // check-normatives as a side effect - the row-level normative comparison below
                // still runs (each measurement resolves/compares its own normative as it's added),
                // but the protocol-level status stays DRAFT until check-normatives is called explicitly.
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(laboratoryId.intValue()))
                .andExpect(jsonPath("$.data.results", hasSize(2)))
                .andExpect(jsonPath("$.data.results[0].internalStatus").exists());
    }

    @Test
    void quickCreate_missingNormative_stillCreatesProtocol() throws Exception {
        templateApiId = "microclimate";
        ensureMicroclimateTemplate();

        String json = """
                {
                  "templateId": "microclimate",
                  "subtype": "MICROCLIMATE",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-01",
                  "measurementDate": "2026-07-01",
                  "measurementPlace": "Цех",
                  "conditions": {
                    "season": "UNKNOWN_SEASON",
                    "workCategory": "UNKNOWN",
                    "workplaceType": "UNKNOWN",
                    "roomType": "UNKNOWN",
                    "normLevel": "UNKNOWN"
                  },
                  "measurements": [
                    {
                      "factorType": "MICROCLIMATE",
                      "factorCode": "UNKNOWN_FACTOR",
                      "indicatorName": "Неизвестный показатель",
                      "value": 1,
                      "unit": "ед"
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId);

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].internalStatus").value("NORMATIVE_NOT_FOUND"));
    }

    /** Regression test for the bug this fix closes: normativeId used to be re-resolved/overridden
     *  by ProtocolNormativeCheckService's own automatic search - a client's explicit selection
     *  could silently lose to an unrelated auto-match. Two distinct normatives are seeded so an
     *  automatic search by pollutantCode (which would find the "autoMatch" row) is a real
     *  possibility, then the client explicitly selects the OTHER one - the persisted result must
     *  carry the explicitly selected id/value, never the auto-matched one. */
    @Test
    void quickCreate_withExplicitNormativeId_isUsedDirectly_notOverriddenByAutoSearch() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();

        NormativeRecord autoMatch = new NormativeRecord();
        autoMatch.setPollutantCode("0311");
        autoMatch.setIndicatorNameRu("Азотная кислота");
        autoMatch.setTemplateType(TemplateType.WORK_ZONE_AIR);
        autoMatch.setEnvironmentType(EnvironmentType.WORK_ZONE_AIR);
        autoMatch.setUnit("мг/м³");
        autoMatch.setValue(new BigDecimal("0.40"));
        autoMatch.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        autoMatch.setActive(true);
        normativeRecordRepository.save(autoMatch);

        NormativeRecord explicitlySelected = new NormativeRecord();
        explicitlySelected.setPollutantCode("9999");
        explicitlySelected.setIndicatorNameRu("Другое вещество (выбрано пользователем)");
        explicitlySelected.setTemplateType(TemplateType.WORK_ZONE_AIR);
        explicitlySelected.setEnvironmentType(EnvironmentType.WORK_ZONE_AIR);
        explicitlySelected.setUnit("мг/м³");
        explicitlySelected.setValue(new BigDecimal("0.05"));
        explicitlySelected.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        explicitlySelected.setActive(true);
        normativeRecordRepository.save(explicitlySelected);

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementTime": "12:00",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "normativeId": "%d",
                      "value": 0.02,
                      "unit": "мг/м³"
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, explicitlySelected.getId());

        MvcResult result = mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andReturn();

        Long protocolId = Long.valueOf(com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
        ProtocolResult savedResult = protocolResultRepository.findByProtocolIdOrderByRowNumberAsc(protocolId).get(0);
        assertEquals(explicitlySelected.getId(), savedResult.getNormativeId(),
                "the explicitly selected normativeId must win over the auto-matched one");
        assertEquals(0, new BigDecimal("0.05").compareTo(savedResult.getNormativeValue()),
                "the value must come from the server-loaded normative, not the client");
    }

    @Test
    void quickCreate_withUnknownNormativeId_returns400_notServerError() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementTime": "12:00",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "normativeId": "999999999",
                      "value": 0.02,
                      "unit": "мг/м³"
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId);

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NORMATIVE_NOT_FOUND"))
                .andExpect(jsonPath("$.fieldErrors['measurements[0].normativeId']").exists());
    }

    @Test
    void quickCreate_workplaceAir_createsProtocol() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();
        MeasurementDevice device = createDevice(LocalDate.now().plusYears(1));

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementTime": "12:00",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "pollutantCode": "0311",
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³",
                      "measurementDeviceId": %d
                    }
                  ]
                }
                """.formatted(companyId, objectId, laboratoryId, executorId, device.getId());

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.results", hasSize(1)))
                .andExpect(jsonPath("$.data.results[0].internalStatus").exists());
    }

    @Test
    void quickCreate_workplaceAir_requiresPollutantCode() throws Exception {
        templateApiId = "workplace_air";
        ensureWorkplaceAirTemplate();

        String json = """
                {
                  "templateId": "workplace_air",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "2026-07-02",
                  "measurementDate": "2026-07-02",
                  "measurementPlace": "Цех",
                  "measurements": [
                    {
                      "indicatorName": "Азотная кислота",
                      "value": 0.2,
                      "unit": "мг/м³"
                    }
                  ]
                }
                """.formatted(companyId, objectId);

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    private void ensureMicroclimateTemplate() {
        if (templateRepository.findByCode("MICROCLIMATE").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("MICROCLIMATE");
            template.setName("Микроклимат");
            template.setDescription("Микроклимат");
            template.setFormCode("PHF");
            template.setActive(true);
            templateRepository.save(template);
        }
    }

    private void ensureWorkplaceAirTemplate() {
        if (templateRepository.findByCode("WORKPLACE_AIR").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("WORKPLACE_AIR");
            template.setName("Воздух рабочей зоны");
            template.setDescription("Воздух рабочей зоны");
            template.setFormCode("VRW");
            template.setActive(true);
            templateRepository.save(template);
        }
    }
}
