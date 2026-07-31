package kz.eco.normative;

import kz.eco.normative.dsm32.Dsm32EnvironmentSafetyImportService;
import kz.eco.normative.dto.Dsm32ImportResult;
import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class Dsm32EnvironmentSafetyImportTest {

    @Autowired
    private Dsm32EnvironmentSafetyImportService importService;

    @Autowired
    private NormativeDirectoryService directoryService;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    @BeforeEach
    void importDsm32() throws Exception {
        importService.importResources();
    }

    @Test
    void table01_importsCobaltFluorineChromium() {
        assertPdkRecord("кобальт", "подвижная форма", new BigDecimal("5.0"), "общесанитарный");
        assertPdkRecord("фтор", "подвижная форма", new BigDecimal("2.8"), "транслокационный");
        assertPdkRecord("хром", "подвижная форма", new BigDecimal("6.0"), "общесанитарный");
    }

    private static NormativeDirectoryService.NormativeQuery dsm32SoilQuery(String searchText) {
        return new NormativeDirectoryService.NormativeQuery(
                null, "soil", null, null, null, null, null, null, null,
                searchText, null, null, true,
                SourceDocumentCode.DSM_32.name(),
                null, null, null, null, null, null, null,
                null, null,
                "ACTIVE", null, null, null, null,
                null, null, null, null, null, null);
    }

    @Test
    void list_dsm32_soil_returnsOnlySoilRecords() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(dsm32SoilQuery(null));

        assertFalse(records.isEmpty());
        assertTrue(records.stream().allMatch(r ->
                "soil".equals(r.templateId())
                        && SourceDocumentCode.DSM_32.name().equals(r.sourceDocumentCode())
                        && r.active()
                        && !Boolean.TRUE.equals(r.archived())));
        assertTrue(records.stream().noneMatch(r ->
                SourceDocumentCode.DSM_70.name().equals(r.sourceDocumentCode())
                        || SourceDocumentCode.DSM_15.name().equals(r.sourceDocumentCode())));
    }

    @Test
    void search_cobalt_returnsDsm32Soil() {
        List<ProtocolApiDtos.NormativeRecord> records = directoryService.search(dsm32SoilQuery("кобальт"));

        assertFalse(records.isEmpty());
        ProtocolApiDtos.NormativeRecord cobalt = records.stream()
                .filter(r -> r.indicatorNameRu() != null && r.indicatorNameRu().toLowerCase().contains("кобальт"))
                .findFirst()
                .orElseThrow();
        assertEquals("soil", cobalt.templateId());
        assertEquals(SourceDocumentCode.DSM_32.name(), cobalt.sourceDocumentCode());
        assertEquals("подвижная форма", cobalt.formType());
    }

    @Test
    void tables2to4_savedAsAssessmentInfo() {
        List<NormativeRecord> assessments = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                        SourceDocumentCode.DSM_32.name()).stream()
                .filter(r -> r.getTableNo() != null && r.getTableNo() >= 2)
                .toList();
        assertFalse(assessments.isEmpty());
        assertTrue(assessments.stream().allMatch(r ->
                r.getNormativeType() == ImportNormativeType.ASSESSMENT
                        && r.getComparisonType() == ComparisonType.INFO
                        && r.getMatrixType() != null));
    }

    @Test
    void import_isIdempotent() throws Exception {
        long countAfterFirst = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_32.name()).size();
        Dsm32ImportResult second = importService.importResources();
        long countAfterSecond = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_32.name()).size();

        assertEquals(countAfterFirst, countAfterSecond);
        assertEquals(0, second.created());
    }

    private void assertPdkRecord(String substance, String formType, BigDecimal value, String limiting) {
        List<NormativeRecord> records = normativeRecordRepository.findDsm32ByUniqueKey(
                SourceDocumentCode.DSM_32.name(),
                1,
                substance,
                formType,
                null,
                null,
                null);
        assertFalse(records.isEmpty(), "Expected PDK for " + substance);
        NormativeRecord record = records.getFirst();
        assertEquals(ImportNormativeType.PDK, record.getNormativeType());
        assertEquals(ComparisonType.LESS_OR_EQUAL, record.getComparisonType());
        assertEquals(0, value.compareTo(record.getValue()));
        assertEquals("мг/кг", record.getUnit());
        assertEquals(limiting, record.getLimitingIndicator());
    }
}
