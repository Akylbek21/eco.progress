package kz.eco.normative;

import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultValuesMapper;
import kz.eco.protocol.ResultInternalStatus;
import kz.eco.protocol.ProtocolNormativeCheckService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class DsmNormativeSearchTest {

    @Autowired
    private NormativeImportService importService;

    @Autowired
    private NormativeDirectoryService directoryService;

    @Autowired
    private PhysicalFactorExcelImportService physicalFactorImportService;

    @Autowired
    private ProtocolNormativeCheckService normativeCheckService;

    @BeforeEach
    void importFixtures() throws Exception {
        ClassPathResource air = new ClassPathResource("xls/dsm-70-atmospheric-air/MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        importService.importResource(air.getContentAsByteArray(), air.getFilename(), null);
        ClassPathResource soil = new ClassPathResource("xls/dsm-32-environment-safety/MPC_soil_UDMH_and_rocket_fuel_components.xls.xls");
        importService.importResource(soil.getContentAsByteArray(), soil.getFilename(), null);
        physicalFactorImportService.importResources();
    }

    @Test
    void searchDsm70_byPollutantCode_findsRecord() {
        var query = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, "ambient_air_szz", "301", null, null, null, null, null,
                null, null, null, true,
                SourceDocumentCode.DSM_70.name(), null, null, null, null, null, null, null, null, null);
        List<kz.eco.protocol.dto.ProtocolApiDtos.NormativeRecord> records = directoryService.search(query);
        assertTrue(records.stream().anyMatch(r -> "0301".equals(r.pollutantCode())
                && SourceDocumentCode.DSM_70.name().equals(r.sourceDocumentCode())));
    }

    @Test
    void searchDsm32_byIndicator_findsSoilRecord() {
        var query = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, "soil", null, null, null, null, null, null,
                null, null, null, true,
                SourceDocumentCode.DSM_32.name(), null, null, null, null, null, null, null, null, null,
                "гидразин");
        List<kz.eco.protocol.dto.ProtocolApiDtos.NormativeRecord> records = directoryService.search(query);
        assertFalse(records.isEmpty());
        assertTrue(records.stream().allMatch(r -> SourceDocumentCode.DSM_32.name().equals(r.sourceDocumentCode())));
    }

    @Test
    void searchDsm15_microclimate_byConditions_findsRecord() {
        var query = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, "microclimate", null, null, null, null, null, null,
                null, null, null, true,
                SourceDocumentCode.DSM_15.name(), "MICROCLIMATE", "AIR_TEMPERATURE",
                null, "COLD", "IA", "PERMANENT", "OPTIMAL", null, null);
        List<kz.eco.protocol.dto.ProtocolApiDtos.NormativeRecord> records = directoryService.search(query);
        assertFalse(records.isEmpty());
        assertTrue(records.stream().anyMatch(r -> "AIR_TEMPERATURE".equals(r.factorCode())));
    }

    @Test
    void checkNormatives_rangeComparison_works() {
        ProtocolResult result = new ProtocolResult();
        result.setIndicatorName("Температура воздуха");
        result.setUnit("°C");
        result.setResultValue(new BigDecimal("22"));
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, java.util.Map.of(
                "factorType", "MICROCLIMATE",
                "factorCode", "AIR_TEMPERATURE",
                "season", "COLD",
                "workCategory", "II",
                "workplaceType", "INDOOR",
                "normLevel", "OPTIMAL",
                "comparisonType", "RANGE",
                "min", "18",
                "max", "24",
                "sourceDocumentCode", SourceDocumentCode.DSM_15.name()
        ));

        normativeCheckService.applyNormativeToResult(result, "MICROCLIMATE", null, LocalDate.now());
        assertEquals(ResultInternalStatus.NORMAL, result.getInternalStatus());
    }

    @Test
    void snapshot_preservesNormativeAfterUpdate() {
        NormativeRecord record = directoryService.search(
                NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                        null, "ambient_air_szz", "301", null, null, null, null, null,
                        null, null, null, true,
                        SourceDocumentCode.DSM_70.name(), null, null, null, null, null, null, null, null, null))
                .stream()
                .filter(r -> "0301".equals(r.pollutantCode()))
                .findFirst()
                .map(api -> normativeCheckService != null ? findEntity(api.id()) : null)
                .orElse(null);
        assertNotNull(record);

        ProtocolResult result = new ProtocolResult();
        result.setPollutantCode("0301");
        result.setResultValue(new BigDecimal("0.1"));
        result.setUnit("мг/м³");
        NormativeSnapshotHelper.applySnapshotToResult(result, record);

        assertNotNull(result.getValuesJson());
        assertTrue(result.getValuesJson().contains(SourceDocumentCode.DSM_70.name()));
        assertTrue(result.getValuesJson().contains("normativeId"));

        record.setValue(new BigDecimal("999"));
        normativeCheckService.compareResult(result, new java.util.ArrayList<>());
        assertEquals(ResultInternalStatus.NORMAL, result.getInternalStatus());
    }

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    private NormativeRecord findEntity(String id) {
        return normativeRecordRepository.findById(Long.parseLong(id)).orElse(null);
    }
}
