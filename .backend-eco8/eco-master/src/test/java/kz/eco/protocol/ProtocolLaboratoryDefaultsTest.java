package kz.eco.protocol;

import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import com.jayway.jsonpath.JsonPath;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class ProtocolLaboratoryDefaultsTest extends ProtocolApiTestSupport {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private LaboratoryRepository laboratoryRepository;

    @Autowired
    private ProtocolRepository protocolRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        seedProtocolFixtures();
        authenticateLabUser();
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void create_withoutLaboratoryId_usesDefaultLaboratory() throws Exception {
        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithoutLaboratory()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(laboratoryId.intValue()))
                .andExpect(jsonPath("$.data.laboratory.id").value(laboratoryId.intValue()));
    }

    @Test
    void refresh_withoutSnapshot_usesDefaultLaboratory() throws Exception {
        MvcResult createResult = mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithoutLaboratory()))
                .andExpect(status().isOk())
                .andReturn();

        Object idValue = JsonPath.read(createResult.getResponse().getContentAsString(), "$.data.id");
        Long protocolId = idValue instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(idValue));

        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setLaboratorySnapshot(null);
        protocolRepository.save(protocol);

        mockMvc.perform(post("/api/protocols/" + protocolId + "/refresh-laboratory-data"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.laboratory.laboratoryId").value(laboratoryId.intValue()))
                .andExpect(jsonPath("$.data.laboratory.id").value(laboratoryId.intValue()));
    }

    @Test
    void create_multipleLabsWithoutDefault_returnsBadRequest() throws Exception {
        laboratoryRepository.findByActiveTrueOrderByNameAsc().forEach(lab -> {
            lab.setDefault(false);
            laboratoryRepository.save(lab);
        });

        Laboratory second = new Laboratory();
        second.setName("Second Lab");
        second.setAddress("Адрес 2");
        second.setAccreditationNumber("KZ.SECOND");
        second.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        second.setActive(true);
        second.setDefault(false);
        laboratoryRepository.save(second);

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithoutLaboratory()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Назначьте лабораторию по умолчанию в настройках."));
    }

    @Test
    void create_noActiveLaboratories_returnsBadRequest() throws Exception {
        laboratoryRepository.findAll().forEach(lab -> {
            lab.setActive(false);
            laboratoryRepository.save(lab);
        });

        mockMvc.perform(post("/api/protocols")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProtocolJsonWithoutLaboratory()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Лаборатория не настроена. Заполните настройки лаборатории."));
    }

    /** laboratoryId is deliberately omitted (that's what this test class exercises - defaulting
     *  to the configured default laboratory), but executorId is still required: the executor is
     *  never silently defaulted to "the first active employee" - see the note on
     *  ProtocolService#resolveExecutorEmployee. executorId here is seedProtocolFixtures()'s
     *  employee, which belongs to that same default laboratory. */
    private String createProtocolJsonWithoutLaboratory() {
        String today = LocalDate.now().toString();
        return """
                {
                  "templateId": "%s",
                  "companyId": %d,
                  "objectId": %d,
                  "executorId": %d,
                  "protocolDate": "%s",
                  "sampleDate": "%s",
                  "testingStartDate": "%s",
                  "testingEndDate": "%s",
                  "measurementPlace": "СЗЗ, точка №1"
                }
                """.formatted(templateApiId, companyId, objectId, executorId, today, today, today, today);
    }
}
