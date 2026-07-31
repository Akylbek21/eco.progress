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
                )), userId);
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
                        )), userId);

        ProtocolCalculationDtos.CalculationResultResponse response =
                calculationService.calculateResult(protocolId, resultId, userId);

        assertEquals(0, new BigDecimal("20").compareTo(response.result()));
        assertEquals(CalculationStatus.CALCULATED.name(), response.calculationStatus());
        assertNotNull(response.row());
        assertEquals(String.valueOf(resultId), String.valueOf(response.row().get("id")));
        assertFalse(calculationRunRepository.findByProtocolResultIdOrderByCreatedAtDesc(resultId).isEmpty());
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
                )), userId);

        assertThrows(Exception.class, () -> calculationService.saveRawMeasurements(
                Long.parseLong(protocol.id()), Long.parseLong(String.valueOf(row.get("id"))), null, userId));
    }
}
