package kz.eco.protocol.calculation;

import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.calculation.dto.ProtocolCalculationDtos;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.protocol.ProtocolCreateRequestFactory;
import kz.eco.protocol.ProtocolService;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ProtocolCalculationServiceTest {

    @Autowired
    private ProtocolCalculationService calculationService;

    @Autowired
    private ProtocolService protocolService;

    @Autowired
    private ProtocolTemplateRepository templateRepository;

    @Autowired
    private MethodTemplateRepository methodTemplateRepository;

    @Autowired
    private CalculationRunRepository calculationRunRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private CompanyObjectRepository companyObjectRepository;

    @Autowired
    private LaboratoryRepository laboratoryRepository;

    @Autowired
    private LaboratoryEmployeeRepository laboratoryEmployeeRepository;

    @Autowired
    private kz.eco.protocol.ProtocolRepository protocolRepository;

    private Long userId;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;

    @BeforeEach
    void setUp() {
        if (templateRepository.findByCode("WATER_WASTEWATER").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("WATER_WASTEWATER");
            template.setName("Вода / сточные воды");
            template.setActive(true);
            templateRepository.save(template);
        }

        User user = new User();
        user.setEmail("calc-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Calc Tester");
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Calc Test");
        company.setBin("998877665544");
        company.setLegalAddress("Адрес");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        company.setObjectName("Станция очистки");
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Станция очистки");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory laboratory = laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue()
                .orElseGet(() -> {
                    Laboratory lab = new Laboratory();
                    lab.setName("Calc Lab");
                    lab.setAddress("Адрес");
                    lab.setAccreditationNumber("KZ.CALC");
                    lab.setAccreditationValidUntil(LocalDate.now().plusYears(2));
                    lab.setDefault(true);
                    lab.setActive(true);
                    return laboratoryRepository.save(lab);
                });
        laboratoryId = laboratory.getId();

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(userId);
        employee.setFullName(user.getName());
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        executorId = employee.getId();
    }

    @Test
    void calculate_sulfates_returnsTwenty() {
        MethodTemplate sulfates = methodTemplateRepository.findByCode("WATER_SULFATES")
                .orElseThrow(() -> new IllegalStateException("MethodTemplate WATER_SULFATES not seeded"));

        ProtocolApiDtos.ProtocolResponse protocol = protocolService.create(
                ProtocolCreateRequestFactory.minimal(
                        "water_wastewater", companyId, objectId, laboratoryId, executorId), userId);

        Map<String, Object> row = protocolService.addResult(Long.parseLong(protocol.id()),
                new ProtocolApiDtos.ResultRow(null, null, null, Map.of(
                        "indicator", "Сульфаты",
                        "pollutantCode", "SO4",
                        "unit", "мг/дм³",
                        "primaryReading", 0
                )), protocol.version(), userId);
        Long protocolId = Long.parseLong(protocol.id());
        Long resultId = Long.parseLong(String.valueOf(row.get("id")));

        calculationService.saveRawMeasurements(protocolId, resultId,
                new ProtocolCalculationDtos.SaveRawMeasurementsRequest(
                        sulfates.getId(),
                        List.of(
                                new ProtocolCalculationDtos.RawMeasurementRequest(
                                        "deviceValue", new BigDecimal("10"), "мг/дм³", "MANUAL", null),
                                new ProtocolCalculationDtos.RawMeasurementRequest(
                                        "dilutionFactor", new BigDecimal("2"), null, "MANUAL", null)
                        ), protocol.version()), userId);

        long currentVersion = protocolService.get(protocolId).version();
        ProtocolCalculationDtos.CalculationResultResponse response =
                calculationService.calculateResult(protocolId, resultId, currentVersion, userId);

        assertEquals(0, new BigDecimal("20").compareTo(response.result()));
        assertEquals(CalculationStatus.CALCULATED.name(), response.calculationStatus());
        assertNotNull(response.row());
        assertEquals(String.valueOf(resultId), String.valueOf(response.row().get("id")));
        assertFalse(calculationRunRepository.findByProtocolResultIdOrderByCreatedAtDesc(resultId).isEmpty());
    }

    /** P0 module fix item 1: saveRawMeasurements' response must carry the ACTUAL post-mutation
     *  protocol.getVersion() (not just the result row), and that version is the one and only
     *  correct If-Match token for the very next mutation - the stale (pre-save) version must now
     *  be rejected with VERSION_CONFLICT, while the fresh one succeeds. */
    @Test
    void saveRawMeasurements_returnsNewVersion_thenStaleVersionIsRejectedAndFreshVersionSucceeds() {
        MethodTemplate sulfates = methodTemplateRepository.findByCode("WATER_SULFATES")
                .orElseThrow(() -> new IllegalStateException("MethodTemplate WATER_SULFATES not seeded"));

        ProtocolApiDtos.ProtocolResponse protocol = protocolService.create(
                ProtocolCreateRequestFactory.minimal(
                        "water_wastewater", companyId, objectId, laboratoryId, executorId), userId);
        Long protocolId = Long.parseLong(protocol.id());
        long versionN = protocol.version();

        Map<String, Object> row = protocolService.addResult(protocolId,
                new ProtocolApiDtos.ResultRow(null, null, null, Map.of(
                        "indicator", "Сульфаты",
                        "pollutantCode", "SO4",
                        "unit", "мг/дм³",
                        "primaryReading", 0
                )), versionN, userId);
        Long resultId = Long.parseLong(String.valueOf(row.get("id")));
        // addResult() bumps contentVersion but only via a plain save() (no flush) - force the
        // pending change to actually flush before reading "N", so the very next mutation
        // (saveRawMeasurements) is the ONLY source of the N->N+1 transition this test verifies.
        protocolRepository.flush();
        long versionBeforeSave = protocolService.get(protocolId).version();

        ProtocolCalculationDtos.SaveRawMeasurementsResponse saveResponse = calculationService.saveRawMeasurements(
                protocolId, resultId,
                new ProtocolCalculationDtos.SaveRawMeasurementsRequest(
                        sulfates.getId(),
                        List.of(
                                new ProtocolCalculationDtos.RawMeasurementRequest(
                                        "deviceValue", new BigDecimal("10"), "мг/дм³", "MANUAL", null),
                                new ProtocolCalculationDtos.RawMeasurementRequest(
                                        "dilutionFactor", new BigDecimal("2"), null, "MANUAL", null)
                        ), versionBeforeSave), userId);

        assertEquals(versionBeforeSave + 1, saveResponse.version(),
                "response.version must reflect the real post-saveAndFlush JPA version, not be omitted");
        assertNotNull(saveResponse.row());
        long versionAfterSave = protocolService.get(protocolId).version();
        assertEquals(saveResponse.version(), versionAfterSave);

        // calculate with the now-stale versionBeforeSave (== N) must 409.
        kz.eco.common.exception.ConflictException conflict = assertThrows(
                kz.eco.common.exception.ConflictException.class,
                () -> calculationService.calculateResult(protocolId, resultId, versionBeforeSave, userId));
        assertEquals("VERSION_CONFLICT", conflict.getCode());

        // calculate with the fresh version (== N+1, exactly what the save response returned) must succeed.
        ProtocolCalculationDtos.CalculationResultResponse calcResponse =
                calculationService.calculateResult(protocolId, resultId, saveResponse.version(), userId);
        assertEquals(0, new BigDecimal("20").compareTo(calcResponse.result()));
    }

    @Test
    void saveRawMeasurements_rejectsNullBody() {
        ProtocolApiDtos.ProtocolResponse protocol = protocolService.create(
                ProtocolCreateRequestFactory.minimal(
                        "water_wastewater", companyId, objectId, laboratoryId, executorId), userId);
        Map<String, Object> row = protocolService.addResult(Long.parseLong(protocol.id()),
                new ProtocolApiDtos.ResultRow(null, null, null, Map.of(
                        "indicator", "Сульфаты",
                        "unit", "мг/дм³",
                        "primaryReading", 0
                )), protocol.version(), userId);

        assertThrows(Exception.class, () -> calculationService.saveRawMeasurements(
                Long.parseLong(protocol.id()), Long.parseLong(String.valueOf(row.get("id"))), null, userId));
    }
}
