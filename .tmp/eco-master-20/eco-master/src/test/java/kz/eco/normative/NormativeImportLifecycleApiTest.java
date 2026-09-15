package kz.eco.normative;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Preview → confirm → status → rollback через REST, плюс сквозной сценарий раздела «Нормативы».
 *
 * <p>MUST stay {@code @Transactional} (см. IdempotentImportTest): очистка normative_records ниже и
 * все импорты откатываются в конце каждого теста и не затрагивают сидированные данные других тестов.
 */
@SpringBootTest
@Transactional
class NormativeImportLifecycleApiTest {

    private static final String RESOURCE = "xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls";
    private static final String FILE_NAME = "MPC_atmospheric_air_with_pollutant_codes.xls";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private NormativeRecordRepository normativeRepo;

    @Autowired
    private ImportBatchRepository batchRepo;

    @Autowired
    private EntityManager entityManager;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        normativeRepo.deleteAll();
        batchRepo.deleteAll();
    }

    private static RequestPostProcessor as(String role) {
        return user("import-" + role.toLowerCase()).roles(role);
    }

    private static MockMultipartFile importFile() throws IOException {
        return new MockMultipartFile("file", FILE_NAME, "application/vnd.ms-excel",
                new ClassPathResource(RESOURCE).getInputStream());
    }

    private Long preview(String role) throws Exception {
        String response = mockMvc.perform(multipart("/api/normatives/import/preview").file(importFile()).with(as(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.importId").isNumber())
                .andReturn().getResponse().getContentAsString();
        return Long.valueOf(JsonPath.read(response, "$.data.importId").toString());
    }

    private String confirm(String role, Long importId) throws Exception {
        return mockMvc.perform(multipart("/api/normatives/import/confirm").file(importFile())
                        .param("importId", importId.toString()).with(as(role)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andReturn().getResponse().getContentAsString();
    }

    private long activeCount() {
        entityManager.flush();
        return normativeRepo.findByActiveTrueOrderByPollutantCodeAsc().size();
    }

    private java.util.Set<Long> activeIdsOf(Long importId) {
        return normativeRepo.findByImportBatchId(importId).stream()
                .filter(NormativeRecord::isActive)
                .map(NormativeRecord::getId)
                .collect(java.util.stream.Collectors.toSet());
    }

    // ---------------------------------------------------------------- preview

    @Test
    void preview_doesNotChangeNormatives_andCreatesPreviewBatch() throws Exception {
        long before = normativeRepo.count();
        Long importId = preview("HEAD");
        assertEquals(before, normativeRepo.count(), "preview не должен менять справочник");

        mockMvc.perform(get("/api/normatives/imports/" + importId).with(as("HEAD")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(importId))
                .andExpect(jsonPath("$.data.status").value("PREVIEW"))
                .andExpect(jsonPath("$.data.totalRows").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.data.createdAt").isString())
                .andExpect(jsonPath("$.data.errors").isArray())
                .andExpect(jsonPath("$.data.canConfirm").value(true))
                .andExpect(jsonPath("$.data.canRollback").value(false));
    }

    @Test
    void preview_withoutFile_returns400() throws Exception {
        mockMvc.perform(multipart("/api/normatives/import/preview").with(as("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void preview_unknownFileType_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "random.txt", MediaType.TEXT_PLAIN_VALUE, "abc".getBytes());
        mockMvc.perform(multipart("/api/normatives/import/preview").file(file).with(as("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void preview_emptyFile_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", FILE_NAME, "application/vnd.ms-excel", new byte[0]);
        mockMvc.perform(multipart("/api/normatives/import/preview").file(file).with(as("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------- confirm

    @Test
    void confirm_createsNormatives_andStatusIsCompleted() throws Exception {
        Long importId = preview("HEAD");
        String response = confirm("HEAD", importId);
        int created = JsonPath.read(response, "$.data.imported");
        int updated = JsonPath.read(response, "$.data.updated");
        assertTrue(created > 0);
        // updated > 0 здесь - повторы показателя внутри одного файла (последнее значение заменяет первое)
        assertEquals(created + updated, normativeRepo.findByImportBatchId(importId).size());

        mockMvc.perform(get("/api/normatives/imports/" + importId).with(as("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.createdCount").value(created))
                .andExpect(jsonPath("$.data.updatedCount").value(updated))
                .andExpect(jsonPath("$.data.skippedCount").isNumber())
                .andExpect(jsonPath("$.data.errorCount").isNumber())
                .andExpect(jsonPath("$.data.confirmedAt").isString())
                .andExpect(jsonPath("$.data.canRollback").value(true));
    }

    @Test
    void confirm_twice_returns409_andCreatesNoDuplicates() throws Exception {
        Long importId = preview("ADMIN");
        confirm("ADMIN", importId);
        long afterFirst = activeCount();

        mockMvc.perform(multipart("/api/normatives/import/confirm").file(importFile())
                        .param("importId", importId.toString()).with(as("ADMIN")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMPORT_ALREADY_CONFIRMED"));
        assertEquals(afterFirst, activeCount());
    }

    @Test
    void reimport_sameFile_skipsExisting_noDuplicates() throws Exception {
        confirm("ADMIN", preview("ADMIN"));
        long afterFirst = activeCount();

        Long second = preview("ADMIN");
        String response = confirm("ADMIN", second);
        assertEquals(0, (int) JsonPath.read(response, "$.data.imported"));
        assertTrue((int) JsonPath.read(response, "$.data.skipped") > 0);
        assertEquals(afterFirst, activeCount());
    }

    @Test
    void confirm_differentFileThanPreview_returns409() throws Exception {
        Long importId = preview("ADMIN");
        MockMultipartFile other = new MockMultipartFile("file", FILE_NAME, "application/vnd.ms-excel",
                new ClassPathResource("xls/OEL_atmospheric_air_with_pollutant_codes.xls.xls").getInputStream());
        mockMvc.perform(multipart("/api/normatives/import/confirm").file(other)
                        .param("importId", importId.toString()).with(as("ADMIN")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMPORT_FILE_MISMATCH"));
        assertTrue(normativeRepo.findByImportBatchId(importId).isEmpty());
    }

    @Test
    void confirm_unknownImportId_returns404() throws Exception {
        mockMvc.perform(multipart("/api/normatives/import/confirm").file(importFile())
                        .param("importId", "987654321").with(as("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void confirm_withoutImportId_returns400() throws Exception {
        mockMvc.perform(multipart("/api/normatives/import/confirm").file(importFile()).with(as("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------- status / rollback errors

    @Test
    void status_unknownImportId_returns404() throws Exception {
        mockMvc.perform(get("/api/normatives/imports/987654321").with(as("ADMIN")))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/normatives/imports/987654321/rollback").with(as("ADMIN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void status_nonNumericImportId_returns400() throws Exception {
        mockMvc.perform(get("/api/normatives/imports/not-a-number").with(as("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rollback_previewOnlyImport_returns409() throws Exception {
        Long importId = preview("ADMIN");
        mockMvc.perform(post("/api/normatives/imports/" + importId + "/rollback").with(as("ADMIN")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMPORT_NOT_CONFIRMED"));
    }

    @Test
    void rollback_twice_returns409() throws Exception {
        Long importId = preview("DIRECTOR");
        confirm("DIRECTOR", importId);
        mockMvc.perform(post("/api/normatives/imports/" + importId + "/rollback").with(as("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ROLLED_BACK"));
        mockMvc.perform(post("/api/normatives/imports/" + importId + "/rollback").with(as("DIRECTOR")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMPORT_ALREADY_ROLLED_BACK"));
    }

    @Test
    void rollback_legacyUrlAliases_stillWork() throws Exception {
        Long importId = preview("ADMIN");
        confirm("ADMIN", importId);
        mockMvc.perform(post("/api/normatives/import/" + importId + "/rollback").with(as("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ROLLED_BACK"));
    }

    @Test
    void rollback_restoresReplacedVersions_andLeavesOtherDataUntouched() throws Exception {
        // «Чужие» данные: норматив, созданный вручную до импорта.
        String manualIndicator = "Ручной норматив " + UUID.randomUUID();
        String manual = mockMvc.perform(post("/api/normatives").with(as("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"templateId":"ambient_air","indicator":"%s","sourceDocumentCode":"DSM_70",
                                 "unit":"мг/м3","comparisonType":"LESS_OR_EQUAL","value":"1"}
                                """.formatted(manualIndicator)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long manualId = Long.valueOf(JsonPath.read(manual, "$.data.id").toString());

        // Импорт №1 создаёт записи.
        Long first = preview("ADMIN");
        confirm("ADMIN", first);
        List<NormativeRecord> firstRecords = normativeRepo.findByImportBatchId(first);
        assertFalse(firstRecords.isEmpty());

        // Имитируем, что до импорта №2 у одного показателя было другое (старое) значение.
        NormativeRecord target = firstRecords.stream()
                .filter(r -> r.getPollutantCode() != null && r.getPollutantCode().matches("\\d{3,10}"))
                .findFirst().orElseThrow();
        BigDecimal importedValue = target.getValue();
        target.setValue(new BigDecimal("999.123"));
        normativeRepo.saveAndFlush(target);
        long activeBefore = activeCount();
        java.util.Set<Long> firstActiveIdsBefore = activeIdsOf(first);

        // Импорт №2 заменяет эту запись новой версией.
        Long second = preview("DIRECTOR");
        String confirm2 = confirm("DIRECTOR", second);
        assertTrue((int) JsonPath.read(confirm2, "$.data.updated") >= 1);
        entityManager.clear();
        assertFalse(normativeRepo.findById(target.getId()).orElseThrow().isActive());
        NormativeRecord replacement = normativeRepo.findByImportBatchId(second).stream()
                .filter(r -> target.getId().equals(r.getReplacedRecordId()))
                .findFirst().orElseThrow();
        assertEquals(0, replacement.getValue().compareTo(importedValue));

        // Импорт №1 нельзя откатить, пока его запись заменена действующим импортом №2.
        mockMvc.perform(post("/api/normatives/imports/" + first + "/rollback").with(as("ADMIN")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMPORT_ROLLBACK_BLOCKED"));

        // Откат №2 возвращает прежнюю версию и гасит новую.
        mockMvc.perform(post("/api/normatives/imports/" + second + "/rollback").with(as("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ROLLED_BACK"))
                .andExpect(jsonPath("$.data.rolledBackAt").isString());
        entityManager.clear();
        NormativeRecord restored = normativeRepo.findById(target.getId()).orElseThrow();
        assertTrue(restored.isActive());
        assertEquals(0, restored.getValue().compareTo(new BigDecimal("999.123")));
        assertFalse(normativeRepo.findById(replacement.getId()).orElseThrow().isActive());
        assertEquals(activeBefore, activeCount(), "после отката состояние справочника - как до импорта №2");
        assertTrue(normativeRepo.findById(manualId).orElseThrow().isActive(), "ручной норматив не затронут");
        assertEquals(firstActiveIdsBefore, activeIdsOf(first), "записи импорта №1 не затронуты");

        // Теперь откат №1 разрешён.
        mockMvc.perform(post("/api/normatives/imports/" + first + "/rollback").with(as("ADMIN")))
                .andExpect(status().isOk());
        entityManager.clear();
        assertTrue(normativeRepo.findById(manualId).orElseThrow().isActive());
    }

    // ---------------------------------------------------------------- end-to-end (ТЗ, п.12)

    @Test
    void endToEndScenario() throws Exception {
        String indicator = "E2E норматив " + UUID.randomUUID();
        // ADMIN создаёт
        String created = mockMvc.perform(post("/api/normatives").with(as("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"templateId":"ambient_air","indicator":"%s","sourceDocumentCode":"DSM_70",
                                 "unit":"мг/м3","comparisonType":"LESS_OR_EQUAL","value":"0.5"}
                                """.formatted(indicator)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(created, "$.data.id").toString();

        // HEAD редактирует
        mockMvc.perform(put("/api/normatives/" + id).with(as("HEAD"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"0.4\"}"))
                .andExpect(status().isOk());
        // LABORATORY и MANAGER читают
        mockMvc.perform(get("/api/normatives/" + id).with(as("LABORATORY")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.value").value(org.hamcrest.Matchers.startsWith("0.4")));
        mockMvc.perform(get("/api/normatives/" + id).with(as("MANAGER"))).andExpect(status().isOk());
        // MANAGER пытается изменить - 403
        mockMvc.perform(put("/api/normatives/" + id).with(as("MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"9\"}"))
                .andExpect(status().isForbidden());
        // DIRECTOR архивирует и восстанавливает
        mockMvc.perform(delete("/api/normatives/" + id).with(as("DIRECTOR")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.active").value(false));
        mockMvc.perform(post("/api/normatives/" + id + "/restore").with(as("DIRECTOR")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.active").value(true));

        // DIRECTOR: preview → confirm → status → rollback
        long activeBeforeImport = activeCount();
        Long importId = preview("DIRECTOR");
        assertEquals(activeBeforeImport, activeCount());
        confirm("DIRECTOR", importId);
        assertTrue(activeCount() > activeBeforeImport);
        mockMvc.perform(get("/api/normatives/imports/" + importId).with(as("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
        mockMvc.perform(post("/api/normatives/imports/" + importId + "/rollback").with(as("DIRECTOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ROLLED_BACK"));

        // данные вернулись в исходное состояние
        assertEquals(activeBeforeImport, activeCount());
        entityManager.clear();
        NormativeRecord manual = normativeRepo.findById(Long.valueOf(id)).orElseThrow();
        assertTrue(manual.isActive());
        assertNotNull(manual.getValue());
        assertEquals(0, manual.getValue().compareTo(new BigDecimal("0.4")));
    }
}
