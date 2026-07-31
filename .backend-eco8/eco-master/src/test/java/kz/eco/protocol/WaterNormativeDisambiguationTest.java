package kz.eco.protocol;

import kz.eco.normative.NormativeRecord;
import kz.eco.normative.NormativeRecordRepository;
import kz.eco.normative.SourceDocumentCode;
import kz.eco.normative.TemplateType;
import kz.eco.protocol.dto.ProtocolApiDtos;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * DSM_138 (water) has parallel normatives for the same pollutant code across different water
 * types (drinking vs surface) and use categories. The auto-search used by quick-create must
 * narrow by waterType/waterUseCategory instead of blindly taking the first row, and must not
 * guess when the context still leaves more than one equally-plausible candidate.
 */
@SpringBootTest
@Transactional
class WaterNormativeDisambiguationTest {

    @Autowired
    private ProtocolNormativeCheckService checkService;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    private static final String POLLUTANT_CODE = "TEST-WATER-0301";

    @Test
    void sameCodeDifferentWaterType_narrowedByConditions() {
        saveWaterNormative("DRINKING", new BigDecimal("0.5"));
        saveWaterNormative("SURFACE", new BigDecimal("1.0"));

        ProtocolApiDtos.QuickCreateMeasurement measurement = measurement();
        ProtocolApiDtos.QuickCreateConditions conditions = conditions("DRINKING", null);

        var resolution = checkService.resolveForQuickCreate("water", measurement, conditions, LocalDate.now());

        assertTrue(resolution.found(), "exactly one candidate remains once waterType narrows it down");
        assertEquals(new BigDecimal("0.5"), resolution.normative().getValue());
    }

    @Test
    void sameCodeDifferentWaterType_noConditions_isAmbiguousNotRandom() {
        saveWaterNormative("DRINKING", new BigDecimal("0.5"));
        saveWaterNormative("SURFACE", new BigDecimal("1.0"));

        ProtocolApiDtos.QuickCreateMeasurement measurement = measurement();
        ProtocolApiDtos.QuickCreateConditions conditions = conditions(null, null);

        var resolution = checkService.resolveForQuickCreate("water", measurement, conditions, LocalDate.now());

        assertFalse(resolution.found(), "must not silently pick one of two equally-plausible normatives");
        assertNotNull(resolution.warning());
    }

    @Test
    void singleMatch_resolvesWithoutNeedingWaterType() {
        saveWaterNormative("DRINKING", new BigDecimal("0.5"));

        ProtocolApiDtos.QuickCreateMeasurement measurement = measurement();
        ProtocolApiDtos.QuickCreateConditions conditions = conditions(null, null);

        var resolution = checkService.resolveForQuickCreate("water", measurement, conditions, LocalDate.now());

        assertTrue(resolution.found());
        assertEquals(new BigDecimal("0.5"), resolution.normative().getValue());
    }

    private void saveWaterNormative(String waterType, BigDecimal value) {
        NormativeRecord record = new NormativeRecord();
        record.setSourceDocumentCode(SourceDocumentCode.DSM_138.name());
        record.setTemplateType(TemplateType.WATER_WASTEWATER);
        record.setPollutantCode(POLLUTANT_CODE);
        record.setIndicatorNameRu("Тестовый показатель воды");
        record.setUnit("мг/дм3");
        record.setValue(value);
        record.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        record.setWaterType(waterType);
        record.setActive(true);
        normativeRecordRepository.save(record);
    }

    private static ProtocolApiDtos.QuickCreateMeasurement measurement() {
        return new ProtocolApiDtos.QuickCreateMeasurement(
                null, null, POLLUTANT_CODE, "Тестовый показатель воды",
                "0.3", "мг/дм3", null, null, null, null, null, null, Map.of());
    }

    private static ProtocolApiDtos.QuickCreateConditions conditions(String waterType, String waterUseCategory) {
        return new ProtocolApiDtos.QuickCreateConditions(
                null, null, null, null, null,
                null, null, null, null,
                null, null, null,
                null, null, null,
                waterType, waterUseCategory,
                null, null, null, null);
    }
}
