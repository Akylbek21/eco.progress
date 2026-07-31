package kz.eco.normative;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class NormativeCreateAndBulkArchiveApiTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void create_targetsNormativeRecord_withUltravioletAliasCanonicalized() throws Exception {
        String body = """
                {
                  "templateId": "physical_factors",
                  "indicator": "Тестовый УФ показатель",
                  "sourceDocumentCode": "DSM_15",
                  "factorType": "ULTRAVIOLET",
                  "unit": "Вт/м2",
                  "comparisonType": "LESS_OR_EQUAL",
                  "value": "10"
                }
                """;
        String response = mockMvc.perform(post("/api/normatives")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.factorType").value("UV"))
                .andReturn().getResponse().getContentAsString();

        Long id = Long.valueOf(JsonPath.read(response, "$.data.id").toString());
        // Only NormativeRecord (the canonical/imported table) has a factorType column at all -
        // NormativeReference (the legacy table create() used to write to) has no such field, so
        // finding this row there proves create() now targets the right table.
        org.junit.jupiter.api.Assertions.assertTrue(normativeRecordRepository.findById(id).isPresent());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void create_rangeWithoutMinOrMax_returns400WithFieldErrors() throws Exception {
        String body = """
                {
                  "templateId": "ambient_air",
                  "indicator": "Показатель без диапазона",
                  "sourceDocumentCode": "DSM_70",
                  "unit": "мг/м3",
                  "comparisonType": "RANGE",
                  "min": "5"
                }
                """;
        mockMvc.perform(post("/api/normatives")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.maxValue").exists());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void create_minGreaterThanMax_returns400() throws Exception {
        String body = """
                {
                  "templateId": "ambient_air",
                  "indicator": "Показатель min>max",
                  "sourceDocumentCode": "DSM_70",
                  "unit": "мг/м3",
                  "comparisonType": "RANGE",
                  "min": "10",
                  "max": "1"
                }
                """;
        mockMvc.perform(post("/api/normatives")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.minValue").exists());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void create_unknownTemplateId_returns400() throws Exception {
        String body = """
                {
                  "templateId": "not_a_real_template",
                  "indicator": "Показатель",
                  "sourceDocumentCode": "DSM_70",
                  "unit": "мг/м3"
                }
                """;
        mockMvc.perform(post("/api/normatives")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.templateId").exists());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void bulkArchive_oneMissingId_rollsBackTheWholeBatch() throws Exception {
        NormativeRecord record = new NormativeRecord();
        record.setIndicatorNameRu("Норматив для массового архивирования");
        record.setSourceDocumentCode("DSM_70");
        record.setActive(true);
        record = normativeRecordRepository.save(record);
        Long validId = record.getId();
        long missingId = validId + 1_000_000L;

        mockMvc.perform(post("/api/normatives/bulk/archive")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [" + validId + ", " + missingId + "]}"))
                .andExpect(status().isNotFound());

        // The transaction must have rolled back entirely - the valid id stays active.
        NormativeRecord reloaded = normativeRecordRepository.findById(validId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(reloaded.isActive());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void bulkArchive_allValid_archivesEveryOne() throws Exception {
        NormativeRecord first = new NormativeRecord();
        first.setIndicatorNameRu("Норматив 1 для массового архивирования");
        first.setSourceDocumentCode("DSM_70");
        first.setActive(true);
        first = normativeRecordRepository.save(first);

        NormativeRecord second = new NormativeRecord();
        second.setIndicatorNameRu("Норматив 2 для массового архивирования");
        second.setSourceDocumentCode("DSM_70");
        second.setActive(true);
        second = normativeRecordRepository.save(second);

        mockMvc.perform(post("/api/normatives/bulk/archive")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [" + first.getId() + ", " + second.getId() + "]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        org.junit.jupiter.api.Assertions.assertFalse(
                normativeRecordRepository.findById(first.getId()).orElseThrow().isActive());
        org.junit.jupiter.api.Assertions.assertFalse(
                normativeRecordRepository.findById(second.getId()).orElseThrow().isActive());
    }
}
