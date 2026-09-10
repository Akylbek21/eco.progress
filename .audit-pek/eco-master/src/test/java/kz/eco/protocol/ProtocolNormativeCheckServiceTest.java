package kz.eco.protocol;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Transactional
class ProtocolNormativeCheckServiceTest {

    @Autowired
    private ProtocolNormativeCheckService checkService;

    @Autowired
    private NormativeReferenceRepository normativeRepository;

    private NormativeReference norm;

    @BeforeEach
    void setUp() {
        norm = new NormativeReference();
        norm.setTemplateCode("workplace_air");
        norm.setIndicatorName("Пыль");
        norm.setUnit("мг/м³");
        norm.setNormativeType(NormativeType.PDK);
        norm.setNormativeValue(new BigDecimal("4.0"));
        norm.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        norm.setActive(true);
        norm.setActiveFrom(LocalDate.of(2020, 1, 1));
        normativeRepository.save(norm);
    }

    @Test
    void lessOrEqual_normal_whenWithinLimit() {
        ProtocolResult result = baseResult(new BigDecimal("2.5"));
        result.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        result.setNormativeValue(new BigDecimal("4.0"));
        checkService.compareResult(result, new ArrayList<>());
        assertEquals(ResultInternalStatus.NORMAL, result.getInternalStatus());
    }

    @Test
    void lessOrEqual_exceeded_whenAboveLimit() {
        ProtocolResult result = baseResult(new BigDecimal("5.0"));
        result.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        result.setNormativeValue(new BigDecimal("4.0"));
        checkService.compareResult(result, new ArrayList<>());
        assertEquals(ResultInternalStatus.EXCEEDED, result.getInternalStatus());
    }

    @Test
    void range_normal_insideRange() {
        ProtocolResult result = baseResult(new BigDecimal("3"));
        result.setComparisonType(ComparisonType.RANGE);
        result.setMinValue(new BigDecimal("1"));
        result.setMaxValue(new BigDecimal("5"));
        checkService.compareResult(result, new ArrayList<>());
        assertEquals(ResultInternalStatus.NORMAL, result.getInternalStatus());
    }

    private static ProtocolResult baseResult(BigDecimal value) {
        ProtocolResult result = new ProtocolResult();
        result.setIndicatorName("Пыль");
        result.setUnit("мг/м³");
        result.setResultValue(value);
        return result;
    }
}
