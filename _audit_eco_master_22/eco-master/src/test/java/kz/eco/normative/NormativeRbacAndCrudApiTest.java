package kz.eco.normative;

import com.jayway.jsonpath.JsonPath;
import kz.eco.audit.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Матрица доступа и CRUD раздела «Нормативы»:
 * ADMIN/DIRECTOR - всё; HEAD - просмотр/создание/изменение/импорт; LABORATORY, MANAGER - только чтение.
 */
@SpringBootTest
@Transactional
class NormativeRbacAndCrudApiTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static RequestPostProcessor as(String role) {
        return user("normative-" + role.toLowerCase()).roles(role);
    }

    private static String createBody(String indicator) {
        return """
                {
                  "templateId": "ambient_air",
                  "indicator": "%s",
                  "sourceDocumentCode": "DSM_70",
                  "unit": "мг/м3",
                  "comparisonType": "LESS_OR_EQUAL",
                  "value": "0.5"
                }
                """.formatted(indicator);
    }

    private static String uniqueIndicator() {
        return "Тестовый норматив " + UUID.randomUUID();
    }

    private Long createAs(String role, String indicator) throws Exception {
        String response = mockMvc.perform(post("/api/normatives").with(as(role))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody(indicator)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.active").value(true))
                .andReturn().getResponse().getContentAsString();
        return Long.valueOf(JsonPath.read(response, "$.data.id").toString());
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    // ---------------------------------------------------------------- ADMIN / DIRECTOR CRUD

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "DIRECTOR"})
    void adminAndDirector_fullCrudArchiveRestore(String role) throws Exception {
        Long id = createAs(role, uniqueIndicator());

        mockMvc.perform(get("/api/normatives/" + id).with(as(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));

        mockMvc.perform(json(put("/api/normatives/" + id).with(as(role)), "{\"value\": \"0.7\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.value").value(org.hamcrest.Matchers.startsWith("0.7")));

        mockMvc.perform(delete("/api/normatives/" + id).with(as(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
        // soft-delete: запись осталась в БД
        assertTrue(normativeRecordRepository.findById(id).isPresent());
        assertFalse(normativeRecordRepository.findById(id).orElseThrow().isActive());

        mockMvc.perform(post("/api/normatives/" + id + "/restore").with(as(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.message").value("Норматив восстановлен"));
        assertTrue(normativeRecordRepository.findById(id).orElseThrow().isActive());
    }

    @Test
    void crud_writesAuditTrail() throws Exception {
        long before = auditLogRepository.count();
        Long id = createAs("ADMIN", uniqueIndicator());
        mockMvc.perform(json(patch("/api/normatives/" + id).with(as("ADMIN")), "{\"value\": \"0.9\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/normatives/" + id + "/archive").with(as("ADMIN"))).andExpect(status().isOk());
        mockMvc.perform(post("/api/normatives/" + id + "/restore").with(as("ADMIN"))).andExpect(status().isOk());

        java.util.List<String> actions = auditLogRepository.findAll().stream()
                .filter(a -> NormativeAuditService.ENTITY_NORMATIVE.equals(a.getEntityType()) && id.equals(a.getEntityId()))
                .map(kz.eco.audit.AuditLog::getActionType)
                .toList();
        assertTrue(actions.containsAll(java.util.List.of(
                NormativeAuditService.ACTION_CREATE, NormativeAuditService.ACTION_UPDATE,
                NormativeAuditService.ACTION_ARCHIVE, NormativeAuditService.ACTION_RESTORE)), actions.toString());
        assertTrue(auditLogRepository.count() >= before + 4);
    }

    // ---------------------------------------------------------------- HEAD

    @Test
    void head_canCreateAndEdit_butNotArchiveOrRestore() throws Exception {
        Long id = createAs("HEAD", uniqueIndicator());

        mockMvc.perform(json(put("/api/normatives/" + id).with(as("HEAD")), "{\"value\": \"0.3\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/normatives/" + id).with(as("HEAD"))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/normatives/" + id + "/archive").with(as("HEAD"))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/normatives/" + id + "/restore").with(as("HEAD"))).andExpect(status().isForbidden());
        mockMvc.perform(json(post("/api/normatives/bulk/archive").with(as("HEAD")), "{\"ids\": [" + id + "]}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/normatives/imports/1/rollback").with(as("HEAD"))).andExpect(status().isForbidden());
        assertTrue(normativeRecordRepository.findById(id).orElseThrow().isActive());
    }

    // ---------------------------------------------------------------- read-only roles

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "LABORATORY"})
    void readOnlyRoles_canRead(String role) throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());

        mockMvc.perform(get("/api/normatives").with(as(role))).andExpect(status().isOk());
        mockMvc.perform(get("/api/normatives/" + id).with(as(role))).andExpect(status().isOk());
        mockMvc.perform(get("/api/normatives/search").param("q", "азот").with(as(role))).andExpect(status().isOk());
        mockMvc.perform(get("/api/normatives/records").param("sourceDocumentCode", "DSM_70").with(as(role)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/normatives/source-documents").with(as(role))).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "LABORATORY"})
    void readOnlyRoles_forbiddenToModify(String role) throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());

        mockMvc.perform(json(post("/api/normatives").with(as(role)), createBody(uniqueIndicator())))
                .andExpect(status().isForbidden());
        mockMvc.perform(json(put("/api/normatives/" + id).with(as(role)), "{\"value\": \"1\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(json(patch("/api/normatives/" + id).with(as(role)), "{\"value\": \"1\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/normatives/" + id).with(as(role))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/normatives/" + id + "/archive").with(as(role))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/normatives/" + id + "/restore").with(as(role))).andExpect(status().isForbidden());
        mockMvc.perform(multipart("/api/normatives/import/preview")
                        .file(new org.springframework.mock.web.MockMultipartFile("file", "x.xls", "application/vnd.ms-excel", new byte[]{1}))
                        .with(as(role)))
                .andExpect(status().isForbidden());
        mockMvc.perform(multipart("/api/normatives/import/confirm")
                        .file(new org.springframework.mock.web.MockMultipartFile("file", "x.xls", "application/vnd.ms-excel", new byte[]{1}))
                        .param("importId", "1").with(as(role)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/normatives/imports/1").with(as(role))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/normatives/imports/1/rollback").with(as(role))).andExpect(status().isForbidden());

        NormativeRecord unchanged = normativeRecordRepository.findById(id).orElseThrow();
        assertTrue(unchanged.isActive());
        assertTrue(unchanged.getValue().compareTo(new java.math.BigDecimal("0.5")) == 0);
    }

    @Test
    void anonymous_isRejected() throws Exception {
        mockMvc.perform(get("/api/normatives")).andExpect(result ->
                assertTrue(result.getResponse().getStatus() == 401 || result.getResponse().getStatus() == 403));
    }

    // ---------------------------------------------------------------- restore / archive edge cases

    @Test
    void restore_alreadyActive_returns200WithoutChange() throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());
        mockMvc.perform(post("/api/normatives/" + id + "/restore").with(as("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.message").value("Норматив уже активен"));
    }

    @Test
    void restore_unknownId_returns404() throws Exception {
        mockMvc.perform(post("/api/normatives/987654321/restore").with(as("ADMIN")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/normatives/987654321").with(as("ADMIN")))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/normatives/987654321").with(as("ADMIN")))
                .andExpect(status().isNotFound());
        mockMvc.perform(json(put("/api/normatives/987654321").with(as("ADMIN")), "{\"value\": \"1\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void restore_whenActiveDuplicateExists_returns409() throws Exception {
        String indicator = uniqueIndicator();
        Long first = createAs("ADMIN", indicator);
        mockMvc.perform(delete("/api/normatives/" + first).with(as("ADMIN"))).andExpect(status().isOk());
        createAs("ADMIN", indicator); // новая действующая запись с теми же условиями

        mockMvc.perform(post("/api/normatives/" + first + "/restore").with(as("ADMIN")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NORMATIVE_DUPLICATE_ACTIVE"));
    }

    @Test
    void archive_twice_isIdempotent() throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());
        mockMvc.perform(delete("/api/normatives/" + id).with(as("ADMIN"))).andExpect(status().isOk());
        mockMvc.perform(delete("/api/normatives/" + id).with(as("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }

    @Test
    void update_archivedNormative_returns409() throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());
        mockMvc.perform(delete("/api/normatives/" + id).with(as("ADMIN"))).andExpect(status().isOk());

        mockMvc.perform(json(put("/api/normatives/" + id).with(as("HEAD")), "{\"value\": \"2\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NORMATIVE_ARCHIVED"));
    }

    @Test
    void archivedNormative_isStillReadableById() throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());
        mockMvc.perform(delete("/api/normatives/" + id).with(as("ADMIN"))).andExpect(status().isOk());
        mockMvc.perform(get("/api/normatives/" + id).with(as("LABORATORY")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }

    // ---------------------------------------------------------------- validation

    @Test
    void create_duplicateActive_returns409() throws Exception {
        String indicator = uniqueIndicator();
        createAs("ADMIN", indicator);
        mockMvc.perform(json(post("/api/normatives").with(as("HEAD")), createBody(indicator)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NORMATIVE_DUPLICATE_ACTIVE"));
    }

    @Test
    void create_blankIndicator_returns400() throws Exception {
        mockMvc.perform(json(post("/api/normatives").with(as("ADMIN")), createBody("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.indicator").exists());
    }

    @Test
    void create_nonNumericValue_returns400() throws Exception {
        String body = createBody(uniqueIndicator()).replace("\"0.5\"", "\"abc\"");
        mockMvc.perform(json(post("/api/normatives").with(as("ADMIN")), body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.value").exists());
    }

    @Test
    void create_invalidDate_returns400() throws Exception {
        String body = createBody(uniqueIndicator()).replace("\"value\": \"0.5\"",
                "\"value\": \"0.5\", \"validFrom\": \"31.12.2024\"");
        mockMvc.perform(json(post("/api/normatives").with(as("ADMIN")), body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.validFrom").exists());
    }

    @Test
    void create_malformedJson_returns400() throws Exception {
        mockMvc.perform(json(post("/api/normatives").with(as("ADMIN")), "{not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_blankIndicator_returns400() throws Exception {
        Long id = createAs("ADMIN", uniqueIndicator());
        mockMvc.perform(json(put("/api/normatives/" + id).with(as("ADMIN")), "{\"indicator\": \"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void get_nonNumericId_isNotRoutedAsId() throws Exception {
        mockMvc.perform(get("/api/normatives/abc").with(as("ADMIN")))
                .andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400
                        && result.getResponse().getStatus() < 500));
    }
}
