package kz.eco.protocol;

import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.Assertions;
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

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * executorId in the protocol API is, by contract, a laboratory_employees.id. Old frontend
 * builds that still send a users.id must keep working (normalized on write), but an
 * executorId from a different laboratory or a lab with no employees must fail clearly.
 */
@SpringBootTest
@Transactional
class ProtocolExecutorContractTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private ProtocolRepository protocolRepository;

    @Autowired
    private ProtocolApiMapper protocolApiMapper;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        ensureMicroclimateTemplate();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
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

    @Test
    void quickCreate_withExecutorEmployeeId_success() throws Exception {
        User user = newUser("exec-employee-id");
        LaboratoryEmployee employee = newEmployee(laboratoryId, user.getId(), "Иванов И.И.");

        MvcResult result = mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(quickCreateJson(laboratoryId, employee.getId())))
                .andExpect(status().isOk())
                .andReturn();

        Protocol protocol = fetchProtocol(result);
        Assertions.assertEquals(employee.getId(),
                protocolApiMapper.resolveExecutorIdFromSnapshot(protocol.getLaboratorySnapshot()));
        Assertions.assertEquals(user.getId(),
                protocolApiMapper.resolveExecutorUserIdFromSnapshot(protocol.getLaboratorySnapshot()));
        Assertions.assertEquals("Иванов И.И.", protocol.getExecutorName());
    }

    @Test
    void quickCreate_withExecutorUserId_legacyCompatibility_success() throws Exception {
        User user = newUser("exec-user-id");
        LaboratoryEmployee employee = newEmployee(laboratoryId, user.getId(), "Петров П.П.");

        MvcResult result = mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(quickCreateJson(laboratoryId, user.getId())))
                .andExpect(status().isOk())
                .andReturn();

        Protocol protocol = fetchProtocol(result);
        Assertions.assertEquals(employee.getId(),
                protocolApiMapper.resolveExecutorIdFromSnapshot(protocol.getLaboratorySnapshot()),
                "snapshot must be normalized to the real employee.id, not the raw userId sent");
        Assertions.assertEquals(user.getId(),
                protocolApiMapper.resolveExecutorUserIdFromSnapshot(protocol.getLaboratorySnapshot()));
    }

    @Test
    void quickCreate_withExecutorFromAnotherLaboratory_returnsBadRequest() throws Exception {
        Laboratory otherLab = newLaboratory("Другая лаборатория", false);
        User user = newUser("exec-other-lab");
        LaboratoryEmployee otherLabEmployee = newEmployee(otherLab.getId(), user.getId(), "Чужой Сотрудник");

        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(quickCreateJson(laboratoryId, otherLabEmployee.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Исполнитель не относится к выбранной лаборатории"));
    }

    @Test
    void quickCreate_withoutExecutorAndNoEmployees_returnsBadRequest() throws Exception {
        // executorId is never silently defaulted (not even when the target lab happens to have
        // exactly zero employees) - the request must always name one explicitly, so this fails at
        // the same top-level "specify executorId" check as any other missing executorId, before
        // ProtocolService#resolveExecutorEmployee even gets a chance to inspect the laboratory.
        Laboratory emptyLab = newLaboratory("Лаборатория без сотрудников", false);

        String json = quickCreateJsonWithoutExecutor(emptyLab.getId());
        mockMvc.perform(post("/api/protocols/quick-create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Укажите executorId"));
    }

    private Protocol fetchProtocol(MvcResult result) throws Exception {
        String id = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString();
        return protocolRepository.findById(Long.valueOf(id)).orElseThrow();
    }

    private User newUser(String suffix) {
        User user = new User();
        user.setEmail(suffix + "-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("User " + suffix);
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);
        return user;
    }

    private LaboratoryEmployee newEmployee(Long laboratoryId, Long userId, String fullName) {
        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(userId);
        employee.setFullName(fullName);
        employee.setPosition("Исполнитель");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        return employee;
    }

    private Laboratory newLaboratory(String name, boolean isDefault) {
        Laboratory lab = new Laboratory();
        lab.setName(name);
        lab.setLegalName("ТОО " + name);
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.TEST." + System.nanoTime());
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(isDefault);
        lab.setActive(true);
        return laboratoryRepository.save(lab);
    }

    private String quickCreateJson(Long laboratoryId, Long executorId) {
        String today = LocalDate.now().toString();
        return """
                {
                  "templateId": "microclimate",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "executorId": %d,
                  "protocolDate": "%s",
                  "measurementDate": "%s",
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
                """.formatted(companyId, objectId, laboratoryId, executorId, today, today);
    }

    private String quickCreateJsonWithoutExecutor(Long laboratoryId) {
        String today = LocalDate.now().toString();
        return """
                {
                  "templateId": "microclimate",
                  "companyId": %d,
                  "objectId": %d,
                  "laboratoryId": %d,
                  "protocolDate": "%s",
                  "measurementDate": "%s",
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
                """.formatted(companyId, objectId, laboratoryId, today, today);
    }
}
