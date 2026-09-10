package kz.eco.pek;

import kz.eco.common.exception.ValidationException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.dto.PekApiDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Task 6 validation coverage for {@link PekProgramService}, calling the service directly (not
 * through MockMvc) since a single create() call needs no version-chained follow-up mutation - see
 * PekReportCollectionReconciliationTest's class javadoc for why this module's tests avoid chaining
 * submit-review/approve/etc within one test method in this environment.
 */
@SpringBootTest
@Transactional
class PekProgramValidationTest {

    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private PekProgramService programService;

    private Long companyId;
    private Long objectId;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("ТОО PEK Validation Test");
        company.setBin("770055556666");
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77005556677");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Объект валидации");
        object.setAddress("г. Алматы");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();
    }

    private PekApiDtos.ControlItemDto controlItem(Integer plannedCount, String frequencyType, Integer frequencyValue) {
        return new PekApiDtos.ControlItemDto(null, "CI-1", "Item", null, "EMISSION", null, null, null, null, null, null,
                frequencyType, frequencyValue, plannedCount, null, null, null, null, null, null, null, null);
    }

    private PekApiDtos.CreateProgramRequest requestWithControlItems(List<PekApiDtos.ControlItemDto> items) {
        return new PekApiDtos.CreateProgramRequest(companyId, objectId, "N-" + System.nanoTime(), "Program", null,
                "2026-01-01", "2026-12-31", null, null, null, items, null, null);
    }

    @Test
    void negativePlannedCount_isRejected() {
        var request = requestWithControlItems(List.of(controlItem(-1, "QUARTERLY", 1)));
        ValidationException ex = assertThrows(ValidationException.class, () -> programService.create(request, 1L));
        assertEquals("PEK_INVALID_PLANNED_COUNT", ex.getCode());
    }

    @Test
    void nonPositiveFrequencyValue_isRejected_whenFrequencyTypeIsNotPerEvent() {
        var request = requestWithControlItems(List.of(controlItem(null, "QUARTERLY", 0)));
        ValidationException ex = assertThrows(ValidationException.class, () -> programService.create(request, 1L));
        assertEquals("PEK_INVALID_FREQUENCY_VALUE", ex.getCode());
    }

    @Test
    void nonPositiveFrequencyValue_isAllowed_forPerEvent() {
        var request = requestWithControlItems(List.of(controlItem(5, "PER_EVENT", 0)));
        // Must not throw - PER_EVENT ignores frequencyValue entirely (module spec: event-driven).
        var response = programService.create(request, 1L);
        assertEquals(1, response.controlItems().size());
    }

    private PekApiDtos.CreateProgramRequest requestWithIndicator(PekApiDtos.IndicatorDto indicator) {
        return new PekApiDtos.CreateProgramRequest(companyId, objectId, "N-" + System.nanoTime(), "Program", null,
                "2026-01-01", "2026-12-31", null, null, null,
                List.of(controlItem(null, "QUARTERLY", 1)), List.of(indicator), null);
    }

    @Test
    void lessOrEqualIndicator_withoutNormativeValue_isRejected() {
        var indicator = new PekApiDtos.IndicatorDto(null, 0, null, null, null, "Пыль", "мг/м3",
                null, null, "LESS_OR_EQUAL", null, null, null, null, null, null);
        var request = requestWithIndicator(indicator);
        ValidationException ex = assertThrows(ValidationException.class, () -> programService.create(request, 1L));
        assertEquals("PEK_INDICATOR_NORMATIVE_REQUIRED", ex.getCode());
    }

    @Test
    void lessOrEqualIndicator_withNormativeValue_isAccepted() {
        var indicator = new PekApiDtos.IndicatorDto(null, 0, null, null, null, "Пыль", "мг/м3",
                null, BigDecimal.TEN, "LESS_OR_EQUAL", null, null, null, null, null, null);
        var request = requestWithIndicator(indicator);
        var response = programService.create(request, 1L);
        assertEquals(1, response.indicators().size());
    }

    @Test
    void rangeIndicator_withoutMinOrMax_isRejected() {
        var indicator = new PekApiDtos.IndicatorDto(null, 0, null, null, null, "pH", null,
                null, null, "RANGE", null, null, null, null, null, null);
        var request = requestWithIndicator(indicator);
        ValidationException ex = assertThrows(ValidationException.class, () -> programService.create(request, 1L));
        assertEquals("PEK_INDICATOR_RANGE_REQUIRED", ex.getCode());
    }

    @Test
    void rangeIndicator_withMinGreaterThanMax_isRejected() {
        var indicator = new PekApiDtos.IndicatorDto(null, 0, null, null, null, "pH", null,
                null, null, "RANGE", BigDecimal.TEN, BigDecimal.ONE, null, null, null, null);
        var request = requestWithIndicator(indicator);
        ValidationException ex = assertThrows(ValidationException.class, () -> programService.create(request, 1L));
        assertEquals("PEK_INDICATOR_RANGE_INVALID", ex.getCode());
    }

    @Test
    void rangeIndicator_betweenAlias_withValidBounds_isAccepted() {
        // BETWEEN is the API-level alias for RANGE (ComparisonType.fromApi) - must be validated
        // (and persisted) exactly like RANGE, not skipped as an unrecognized value.
        var indicator = new PekApiDtos.IndicatorDto(null, 0, null, null, null, "pH", null,
                null, null, "BETWEEN", BigDecimal.ONE, BigDecimal.TEN, null, null, null, null);
        var request = requestWithIndicator(indicator);
        var response = programService.create(request, 1L);
        assertEquals("RANGE", response.indicators().get(0).comparisonType());
    }

    @Test
    void indicatorWithoutComparisonType_isAccepted_noValueRequired() {
        var indicator = new PekApiDtos.IndicatorDto(null, 0, null, null, null, "Информационный показатель", null,
                null, null, null, null, null, null, null, null, null);
        var request = requestWithIndicator(indicator);
        var response = programService.create(request, 1L);
        assertEquals(1, response.indicators().size());
    }
}
