package kz.eco.pek;

import kz.eco.protocol.ComparisonType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pure logic, no Spring context: exceedance detection and severity classification (module spec
 *  §14). Value 0 is deliberately exercised throughout since it must never be treated as "no
 *  measurement" - a real zero result is a real result. */
class PekPlanFactExceedanceCalculationTest {

    @Test
    void lessOrEqual_valueWithinLimit_noExceedance() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("0.02"), new BigDecimal("0.05"), null, null, ComparisonType.LESS_OR_EQUAL);
        assertTrue(ratio.isEmpty());
    }

    @Test
    void lessOrEqual_zeroValue_neverExceeds() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                BigDecimal.ZERO, new BigDecimal("0.05"), null, null, ComparisonType.LESS_OR_EQUAL);
        assertTrue(ratio.isEmpty());
    }

    @Test
    void lessOrEqual_valueOverLimit_computesRatio() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("0.10"), new BigDecimal("0.05"), null, null, ComparisonType.LESS_OR_EQUAL);
        assertEquals(0, new BigDecimal("2.0000").compareTo(ratio.orElseThrow()));
    }

    @Test
    void greaterOrEqual_valueBelowMinimum_computesRatio() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("2"), new BigDecimal("10"), null, null, ComparisonType.GREATER_OR_EQUAL);
        assertEquals(0, new BigDecimal("5.0000").compareTo(ratio.orElseThrow()));
    }

    @Test
    void greaterOrEqual_valueAtOrAboveMinimum_noExceedance() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("12"), new BigDecimal("10"), null, null, ComparisonType.GREATER_OR_EQUAL);
        assertTrue(ratio.isEmpty());
    }

    @Test
    void range_belowLowerBound_exceeds() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("1"), null, new BigDecimal("5"), new BigDecimal("10"), ComparisonType.RANGE);
        assertTrue(ratio.isPresent());
    }

    @Test
    void range_withinBounds_noExceedance() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("7"), null, new BigDecimal("5"), new BigDecimal("10"), ComparisonType.RANGE);
        assertTrue(ratio.isEmpty());
    }

    @Test
    void absent_positiveValue_exceeds() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("0.01"), null, null, null, ComparisonType.ABSENT);
        assertTrue(ratio.isPresent());
    }

    @Test
    void absent_zeroValue_noExceedance() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                BigDecimal.ZERO, null, null, null, ComparisonType.ABSENT);
        assertTrue(ratio.isEmpty());
    }

    @Test
    void info_neverExceeds() {
        Optional<BigDecimal> ratio = PekPlanFactService.exceedanceRatio(
                new BigDecimal("999"), new BigDecimal("1"), null, null, ComparisonType.INFO);
        assertTrue(ratio.isEmpty());
    }

    @Test
    void severity_classification_thresholds() {
        assertEquals(PekExceedanceSeverity.LOW, PekPlanFactService.classifySeverity(new BigDecimal("1.2")));
        assertEquals(PekExceedanceSeverity.MEDIUM, PekPlanFactService.classifySeverity(new BigDecimal("1.8")));
        assertEquals(PekExceedanceSeverity.HIGH, PekPlanFactService.classifySeverity(new BigDecimal("3.0")));
        assertEquals(PekExceedanceSeverity.CRITICAL, PekPlanFactService.classifySeverity(new BigDecimal("8.0")));
    }
}
