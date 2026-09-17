package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
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
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolDraftContractApiTest extends ProtocolApiTestSupport {
    @Autowired WebApplicationContext context;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void minimalDraft_isIdempotentForSameKey() throws Exception {
        String body = "{\"templateId\":\"" + templateApiId + "\"}";
        String key = "draft-" + System.nanoTime();
        MvcResult first = mockMvc.perform(post("/api/protocols/drafts")
                        .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn();
        MvcResult second = mockMvc.perform(post("/api/protocols/drafts")
                        .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        assertEquals(JsonPath.read(first.getResponse().getContentAsString(), "$.data.id").toString(),
                JsonPath.read(second.getResponse().getContentAsString(), "$.data.id").toString());
    }

    @Test
    void draftEnvironment_roundTripsAllTypeConditions() throws Exception {
        String today = java.time.LocalDate.now().toString();
        String body = """
                {"templateId":"%s","companyId":%d,"objectId":%d,"laboratoryId":%d,
                 "testingStartDate":"%s","testingEndDate":"%s",
                 "environment":{"temperature":25.4,"humidity":40.2,"pressure":95.1,"windSpeed":2.5,
                   "conditions":{"waterType":"DRINKING_WATER","waterUseCategory":"CENTRALIZED",
                    "roomType":"OFFICE","workplaceType":"PERMANENT","lightingType":"ARTIFICIAL",
                    "noiseType":"CONSTANT","season":"WARM","workCategory":"IIA",
                    "visualWorkCategory":"III","normLevel":"WORKPLACE","sampleNumber":"1",
                    "samplingPlace":"Точка отбора №1","samplingDepth":0.5,"factorType":"MICROCLIMATE"}}}
                """.formatted(templateApiId, companyId, objectId, laboratoryId, today, today);
        MvcResult created = mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString();
        mockMvc.perform(get("/api/protocols/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.environment.temperatureC").value(25.4))
                .andExpect(jsonPath("$.data.environment.conditions.waterType").value("DRINKING_WATER"))
                .andExpect(jsonPath("$.data.environment.conditions.samplingDepth").value("0.5"))
                .andExpect(jsonPath("$.data.environment.conditions.factorType").value("MICROCLIMATE"));
    }

    @Test
    void laboratoryAndExecutor_areResolvedAtomically() throws Exception {
        String body = "{\"templateId\":\"" + templateApiId + "\"}";
        MvcResult created = mockMvc.perform(post("/api/protocols/drafts")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString();

        Laboratory second = new Laboratory();
        second.setName("Second authoritative laboratory");
        second.setAddress("Server address");
        second.setAccreditationNumber("KZ.SECOND");
        second.setAccreditationValidUntil(java.time.LocalDate.now().plusYears(1));
        second.setActive(true);
        second = laboratoryRepository.save(second);
        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(second.getId());
        employee.setUserId(labUser.getId());
        employee.setFullName("Second executor");
        employee.setActive(true);
        employee = laboratoryEmployeeRepository.save(employee);

        mockMvc.perform(patch("/api/protocols/" + id + "/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"laboratoryId\":" + second.getId() + ",\"executorId\":"
                                + employee.getId() + ",\"laboratory\":{\"name\":\"spoofed\"},\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(second.getId().toString()))
                .andExpect(jsonPath("$.data.laboratory.executorId").value(employee.getId().toString()))
                .andExpect(jsonPath("$.data.laboratory.name").value("Second authoritative laboratory"));
    }
}
