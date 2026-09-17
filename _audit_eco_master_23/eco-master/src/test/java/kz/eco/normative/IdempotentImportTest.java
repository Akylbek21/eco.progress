package kz.eco.normative;

import kz.eco.normative.dto.NormativeImportDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * MUST stay {@code @Transactional} (was missing this before - see the module search-bug audit):
 * without it, {@code normativeRepo.deleteAll()} below permanently wipes the ENTIRE shared
 * normative_records table (not just this test's own rows) for every other test class that runs
 * afterward in the same JVM, since it's a real committed delete with nothing to restore the
 * startup-seeded DSM_70/32/15/138 data. That was the actual root cause of
 * Dsm138CategoryFilterApiTest and other unrelated tests seeing zero results only when run as
 * part of the full suite (never in isolation) - not a query-logic bug, a test-isolation one.
 * With @Transactional, deleteAll()/every import here rolls back at the end of each test method.
 */
@SpringBootTest
@Transactional
class IdempotentImportTest {

    @Autowired
    private NormativeImportService importService;

    @Autowired
    private NormativeRecordRepository normativeRepo;

    @Autowired
    private ImportBatchRepository batchRepo;

    @BeforeEach
    void cleanupBefore() {
        normativeRepo.deleteAll();
        batchRepo.deleteAll();
    }

    @Test
    void repeatedImport_doesNotCreateDuplicates() throws IOException {
        MockMultipartFile file = loadResourceFile("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls",
                "MPC_atmospheric_air_with_pollutant_codes.xls");

        NormativeImportDtos.ImportPreviewResponse preview1 = importService.previewImport(file);
        NormativeImportDtos.ImportConfirmResponse confirm1 = importService.confirmImport(preview1.importId(), file);
        long countAfterFirst = normativeRepo.findByActiveTrueOrderByPollutantCodeAsc().size();

        NormativeImportDtos.ImportPreviewResponse preview2 = importService.previewImport(file);
        NormativeImportDtos.ImportConfirmResponse confirm2 = importService.confirmImport(preview2.importId(), file);
        long countAfterSecond = normativeRepo.findByActiveTrueOrderByPollutantCodeAsc().size();

        assertTrue(confirm1.imported() > 0);
        assertTrue(confirm2.skipped() > 0, "Повторный импорт должен пропускать существующие записи");
        assertEquals(countAfterFirst, countAfterSecond, "Повторный импорт не должен создавать дубли");
    }

    @Test
    void repeatedResourceImport_isIdempotent() throws IOException {
        ClassPathResource resource = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        byte[] bytes = resource.getContentAsByteArray();
        String fileName = "MPC_atmospheric_air_with_pollutant_codes.xls.xls";

        importService.importResource(bytes, fileName, null);
        long afterFirst = normativeRepo.findByActiveTrueOrderByPollutantCodeAsc().size();
        importService.importResource(bytes, fileName, null);
        long afterSecond = normativeRepo.findByActiveTrueOrderByPollutantCodeAsc().size();

        assertTrue(afterFirst > 0);
        assertEquals(afterFirst, afterSecond, "Повторный classpath-импорт не должен плодить записи");
    }

    private MockMultipartFile loadResourceFile(String resourcePath, String fileName) throws IOException {
        ClassPathResource resource = new ClassPathResource(resourcePath);
        return new MockMultipartFile("file", fileName, "application/vnd.ms-excel", resource.getInputStream());
    }
}
