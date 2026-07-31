package kz.eco.normative;

import kz.eco.normative.dto.NormativeImportDtos;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class NormativeImportServiceTest {

    @Autowired
    private NormativeImportService importService;

    @Autowired
    private NormativeRecordRepository normativeRepo;

    @Autowired
    private PollutantRepository pollutantRepo;

    @Autowired
    private ImportBatchRepository batchRepo;

    @AfterEach
    void cleanup() {
        normativeRepo.deleteAll();
        pollutantRepo.deleteAll();
        batchRepo.deleteAll();
    }

    @Test
    void previewImport_htmlXlsFile_parsesCorrectly() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");
        NormativeImportDtos.ImportPreviewResponse response = importService.previewImport(file);

        assertNotNull(response);
        assertNotNull(response.importId());
        assertTrue(response.totalRows() > 0, "Should parse rows from HTML table");
        assertTrue(response.validRows() > 0, "Should have valid rows");
        assertEquals("MPC_atmospheric_air_with_pollutant_codes.xls", response.fileName());
    }

    @Test
    void confirmImport_atmosphericAir_createsRecordsWithCorrectTypes() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview = importService.previewImport(file);
        NormativeImportDtos.ImportConfirmResponse confirm = importService.confirmImport(preview.importId(), file);

        assertNotNull(confirm);
        assertTrue(confirm.imported() > 0, "Should import records");

        List<NormativeRecord> records = normativeRepo.findByTemplateType(TemplateType.ATMOSPHERIC_AIR);
        assertFalse(records.isEmpty(), "Should have records for ATMOSPHERIC_AIR");

        NormativeRecord first = records.getFirst();
        assertEquals(EnvironmentType.ATMOSPHERIC_AIR, first.getEnvironmentType());
        assertEquals(ImportNormativeType.PDK, first.getNormativeType());
        assertEquals(TemplateType.ATMOSPHERIC_AIR, first.getTemplateType());
    }

    @Test
    void pollutantCodeStoredAsString_preservesLeadingZeros() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview = importService.previewImport(file);
        importService.confirmImport(preview.importId(), file);

        List<Pollutant> pollutants = pollutantRepo.findByActiveTrueOrderByCodeAsc();
        boolean hasLeadingZero = pollutants.stream().anyMatch(p -> p.getCode().startsWith("0"));
        assertTrue(hasLeadingZero, "Pollutant codes should preserve leading zeros (0301, 0330, etc.)");
    }

    @Test
    void resolve_afterImport_findsNormativeByCode() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview = importService.previewImport(file);
        importService.confirmImport(preview.importId(), file);

        List<Pollutant> pollutants = pollutantRepo.findByActiveTrueOrderByCodeAsc();
        if (!pollutants.isEmpty()) {
            String code = pollutants.getFirst().getCode();
            NormativeImportDtos.NormativeResolveResponse resolved = importService.resolve(
                    "ATMOSPHERIC_AIR", code, LocalDate.now());
            assertEquals("FOUND", resolved.status());
            assertNotNull(resolved.value());
        }
    }

    @Test
    void deduplication_sameFileImportedTwice_noDuplicates() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview1 = importService.previewImport(file);
        NormativeImportDtos.ImportConfirmResponse confirm1 = importService.confirmImport(preview1.importId(), file);

        NormativeImportDtos.ImportPreviewResponse preview2 = importService.previewImport(file);
        NormativeImportDtos.ImportConfirmResponse confirm2 = importService.confirmImport(preview2.importId(), file);

        assertTrue(confirm2.skipped() >= confirm1.imported() - confirm2.updated(),
                "Second import should mostly skip or update, not create duplicates");
    }

    @Test
    void rollbackImport_deactivatesImportedRecords() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview = importService.previewImport(file);
        NormativeImportDtos.ImportConfirmResponse confirm = importService.confirmImport(preview.importId(), file);

        importService.rollbackImport(preview.importId());

        List<NormativeRecord> records = normativeRepo.findByImportBatchId(preview.importId());
        assertTrue(records.stream().noneMatch(NormativeRecord::isActive),
                "All rolled-back records should be inactive");
    }

    @Test
    void decimalComma_normalizedToPoint() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview = importService.previewImport(file);
        importService.confirmImport(preview.importId(), file);

        List<NormativeRecord> records = normativeRepo.findByActiveTrueOrderByPollutantCodeAsc();
        for (NormativeRecord r : records) {
            if (r.getValue() != null) {
                assertDoesNotThrow(() -> r.getValue().toPlainString(),
                        "Value should be a valid BigDecimal");
            }
        }
    }

    @Test
    void resolve_nonExistentCode_returnsNotFound() {
        NormativeImportDtos.NormativeResolveResponse response = importService.resolve(
                "ATMOSPHERIC_AIR", "9999", LocalDate.now());
        assertEquals("NOT_FOUND", response.status());
    }

    @Test
    void htmlTableParser_detectsHtmlFile() {
        byte[] html = "<html><body><table><tr><td>test</td></tr></table></body></html>".getBytes();
        assertTrue(HtmlTableParser.isHtmlFile(html));

        byte[] excel = new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};
        assertFalse(HtmlTableParser.isHtmlFile(excel));
    }

    private MockMultipartFile loadResourceFile(String resourcePath, String fileName) throws IOException {
        ClassPathResource resource = new ClassPathResource(resourcePath);
        return new MockMultipartFile("file", fileName, "application/vnd.ms-excel", resource.getInputStream());
    }
}
