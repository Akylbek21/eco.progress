package kz.eco.normative;

import kz.eco.normative.dto.PhysicalFactorImportResult;
import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultValuesMapper;
import kz.eco.protocol.ProtocolNormativeCheckService;
import kz.eco.protocol.ResultInternalStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class Dsm15PhysicalFactorImportTest {

    @Autowired
    private PhysicalFactorExcelImportService importService;

    @Autowired
    private NormativeDirectoryService directoryService;

    @Autowired
    private ProtocolNormativeCheckService normativeCheckService;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    @BeforeEach
    void importDsm15() throws Exception {
        importService.importResources();
    }

    @Test
    void import_isIdempotent() throws Exception {
        long countAfterFirst = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_15.name()).size();
        PhysicalFactorImportResult second = importService.importResources();
        long countAfterSecond = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                SourceDocumentCode.DSM_15.name()).size();

        assertEquals(countAfterFirst, countAfterSecond);
        assertEquals(0, second.created());
    }

    @Test
    void import_createsRecordsForMultipleFactorTypes() {
        var factorTypes = normativeRecordRepository.findBySourceDocumentCodeAndActiveTrue(
                        SourceDocumentCode.DSM_15.name()).stream()
                .map(NormativeRecord::getFactorType)
                .filter(type -> type != null && !type.isBlank())
                .distinct()
                .sorted()
                .toList();
        assertTrue(factorTypes.size() >= 5, "factor types: " + factorTypes);
        assertTrue(factorTypes.contains("MICROCLIMATE"));
        assertTrue(factorTypes.contains("NOISE"));
        assertTrue(factorTypes.contains("LIGHTING"));
        assertTrue(factorTypes.contains("INFRASOUND"));
        assertTrue(factorTypes.contains("ULTRASOUND"));
    }

    @Test
    void search_noiseFactorType_returnsPhysicalFactorsContract() {
        var query = new NormativeDirectoryService.NormativeQuery(
                null, "physical_factors", null, null, null, null, null, null, null,
                null, null, null, true,
                SourceDocumentCode.DSM_15.name(),
                "NOISE", null, null, null, null, null, null,
                null, null,
                "ACTIVE", null, null, null, null,
                null, null, null, null, null, null);
        var records = directoryService.search(query);
        assertFalse(records.isEmpty());
        assertTrue(records.stream().allMatch(r ->
                "physical_factors".equals(r.templateId())
                        && SourceDocumentCode.DSM_15.name().equals(r.sourceDocumentCode())
                        && "NOISE".equals(r.factorType())));
    }

    @Test
    void microclimateTable01_importsAirTemperatureForColdIa() {
        List<NormativeRecord> records = normativeRecordRepository.findPhysicalFactorByUniqueKey(
                SourceDocumentCode.DSM_15.name(),
                1,
                1,
                "MICROCLIMATE",
                "AIR_TEMPERATURE",
                "COLD",
                "IA",
                "ANY",
                "OPTIMAL",
                null,
                null);
        assertFalse(records.isEmpty());
        NormativeRecord record = records.getFirst();
        assertEquals(ComparisonType.RANGE, record.getComparisonType());
        assertEquals(new BigDecimal("22"), record.getMinValue());
        assertEquals(new BigDecimal("24"), record.getMaxValue());
    }

    @Test
    void search_airTemperature_coldIaPermanent_returns22to24() {
        var query = NormativeDirectoryService.NormativeQuery.fromExtendedParams(
                null, "microclimate", null, null, null, null, null, null,
                null, null, null, true,
                SourceDocumentCode.DSM_15.name(), "MICROCLIMATE", "AIR_TEMPERATURE",
                null, "COLD", "IA", "PERMANENT", "OPTIMAL", 1, 1);
        var records = directoryService.search(query);
        assertFalse(records.isEmpty());
        assertTrue(records.stream().anyMatch(r ->
                "AIR_TEMPERATURE".equals(r.factorCode())
                        && "22".equals(r.min())
                        && "24".equals(r.max())));
    }

    @Test
    void checkNormatives_23_5_isNormal() {
        ProtocolResult result = buildTemperatureResult(new BigDecimal("23.5"));
        normativeCheckService.applyNormativeToResult(result, "MICROCLIMATE", null, LocalDate.now());
        assertEquals(ResultInternalStatus.NORMAL, result.getInternalStatus());
    }

    @Test
    void checkNormatives_30_isExceeded() {
        ProtocolResult result = buildTemperatureResult(new BigDecimal("30"));
        normativeCheckService.applyNormativeToResult(result, "MICROCLIMATE", null, LocalDate.now());
        assertEquals(ResultInternalStatus.EXCEEDED, result.getInternalStatus());
    }

    @Test
    void checkNormatives_missingNormative_doesNotBreakProtocol() {
        ProtocolResult result = new ProtocolResult();
        result.setIndicatorName("Неизвестный показатель");
        result.setUnit("ед");
        result.setResultValue(new BigDecimal("1"));
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, java.util.Map.of(
                "factorType", "MICROCLIMATE",
                "factorCode", "UNKNOWN_CODE",
                "season", "UNKNOWN",
                "workCategory", "UNKNOWN",
                "workplaceType", "UNKNOWN",
                "normLevel", "UNKNOWN"
        ));

        normativeCheckService.applyNormativeToResult(result, "MICROCLIMATE", null, LocalDate.now());
        assertEquals(ResultInternalStatus.NORMATIVE_NOT_FOUND, result.getInternalStatus());
    }

    private ProtocolResult buildTemperatureResult(BigDecimal value) {
        ProtocolResult result = new ProtocolResult();
        result.setIndicatorName("Температура воздуха");
        result.setUnit("°C");
        result.setResultValue(value);
        ProtocolResultValuesMapper.mergeNormativeSnapshot(result, java.util.Map.of(
                "factorType", "MICROCLIMATE",
                "factorCode", "AIR_TEMPERATURE",
                "season", "COLD",
                "workCategory", "IA",
                "workplaceType", "PERMANENT",
                "normLevel", "OPTIMAL"
        ));
        return result;
    }
}
