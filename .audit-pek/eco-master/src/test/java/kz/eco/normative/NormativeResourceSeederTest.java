package kz.eco.normative;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class NormativeResourceSeederTest {

    @Autowired
    private NormativeImportService importService;

    @Autowired
    private NormativeRecordRepository normativeRecordRepository;

    @BeforeEach
    void importAtmosphericReference() throws IOException {
        ClassPathResource resource = new ClassPathResource("xls/MPC_atmospheric_air_with_pollutant_codes.xls.xls");
        importService.importResource(resource.getContentAsByteArray(),
                "MPC_atmospheric_air_with_pollutant_codes.xls.xls", null);
    }

    @Test
    void seederImportsClasspathResources() {
        assertFalse(normativeRecordRepository.findByActiveTrueOrderByPollutantCodeAsc().isEmpty(),
                "После старта должны быть записи из resources/xls");
    }

    @Test
    void seederPreservesPollutantCode0301() {
        boolean has0301 = normativeRecordRepository.findByActiveTrueOrderByPollutantCodeAsc().stream()
                .anyMatch(record -> "0301".equals(record.getPollutantCode()));
        assertTrue(has0301, "Код 0301 должен сохраняться как строка 0301");
    }

    @Test
    void seederImportsNitrogenDioxideWithSubTypes() {
        var records = normativeRecordRepository.findByActiveTrueOrderByPollutantCodeAsc().stream()
                .filter(record -> "0301".equals(record.getPollutantCode()))
                .toList();
        assertFalse(records.isEmpty());
        assertTrue(records.stream().anyMatch(record -> record.getIndicatorNameRu() != null
                && record.getIndicatorNameRu().toLowerCase().contains("диоксид")));
        assertTrue(records.stream().anyMatch(record -> NormativeSubType.MAX_ONE_TIME.equals(record.getNormativeSubType())
                && record.getValue() != null && record.getValue().compareTo(new BigDecimal("0.2")) == 0));
        assertTrue(records.stream().anyMatch(record -> NormativeSubType.DAILY_AVERAGE.equals(record.getNormativeSubType())
                && record.getValue() != null && record.getValue().compareTo(new BigDecimal("0.04")) == 0));
    }
}
