package kz.eco.protocol.calculation;

import kz.eco.common.exception.ConflictException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.protocol.ProtocolService;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.protocol.dto.ProtocolApiDtos;
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

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Module fix: POST /protocols/{id}/calculate and /protocols/{id}/results/{resultId}/calculate
 *  previously ran a recalculation unconditionally, with no way for a client to detect it was
 *  acting on stale data. Both now accept an optional {version} body and reject a mismatch with
 *  409 VERSION_CONFLICT before doing any work - same convention as ProtocolVersionConflictTest. */
@SpringBootTest
@Transactional
class ProtocolCalculationVersionConflictTest {

    @Autowired private ProtocolService protocolService;
    @Autowired private ProtocolCalculationService calculationService;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;

    private String templateCode;
    private Long userId;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;

    @BeforeEach
    void setUp() {
        if (templateRepository.findByCode("AMBIENT_AIR_SZZ").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("AMBIENT_AIR_SZZ");
            template.setName("Атмосферный воздух / СЗЗ");
            template.setActive(true);
            templateRepository.save(template);
        }
        templateCode = templateRepository.findByCode("AMBIENT_AIR_SZZ").orElseThrow().getCode();

        User user = new User();
        user.setEmail("calc-version-conflict-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Calc Version Conflict Tester");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Calc Version Conflict");
        company.setBin("222233334444");
        company.setLegalAddress("Адрес");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        company.setObjectName("Цех");
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех");
        object.setAddress("Адрес объекта");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory laboratory = laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue()
                .orElseGet(() -> {
                    Laboratory lab = new Laboratory();
                    lab.setName("Test Lab");
                    lab.setAddress("Адрес");
                    lab.setAccreditationNumber("KZ.TEST");
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
        employee.setEmail(user.getEmail());
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        executorId = employee.getId();
    }

    private ProtocolApiDtos.ProtocolResponse createDraftWithResult() {
        ProtocolApiDtos.ProtocolResponse p = protocolService.create(new ProtocolApiDtos.CreateProtocolRequest(
                templateCode, companyId, objectId, null,
                LocalDate.now().toString(), LocalDate.now().toString(), LocalDate.now().toString(),
                LocalDate.now().toString(), LocalDate.now().toString(), LocalDate.now().toString(),
                "Контроль", "Контроль", "Контроль", "20°C", "20°C", "Продукция", "Договор",
                null, null, null, null, null, null, null, null, null, null, null,
                laboratoryId, executorId, null, null, null), userId);
        protocolService.addResult(Long.parseLong(p.id()), new ProtocolApiDtos.ResultRow(
                null, null, null,
                Map.of("indicator", "Пыль", "pollutantCode", "0301", "unit", "мг/м³", "result", 1.5,
                        "samplingPlace", "Место 1", "pdk", 4.0)
        ), p.version(), userId);
        return protocolService.get(Long.parseLong(p.id()));
    }

    private long firstResultId(long protocolId) {
        ProtocolApiDtos.ProtocolResponse p = protocolService.get(protocolId);
        return Long.parseLong(String.valueOf(p.results().get(0).get("id")));
    }

    @Test
    void calculateResult_currentVersion_succeeds() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long resultId = firstResultId(id);
        var response = calculationService.calculateResult(id, resultId, p.version(), userId);
        assertTrue(response.calculationStatus() != null);
    }

    @Test
    void calculateResult_staleVersion_rejectedWith409VersionConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long resultId = firstResultId(id);
        long staleVersion = p.version() - 1;
        ConflictException ex = assertThrows(ConflictException.class,
                () -> calculationService.calculateResult(id, resultId, staleVersion, userId));
        assertEquals("VERSION_CONFLICT", ex.getCode());
    }

    @Test
    void calculateProtocol_currentVersion_succeeds() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        var response = calculationService.calculateProtocol(id, p.version(), userId);
        assertEquals(1, response.total());
    }

    @Test
    void calculateProtocol_staleVersion_rejectedWith409VersionConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long staleVersion = p.version() - 1;
        ConflictException ex = assertThrows(ConflictException.class,
                () -> calculationService.calculateProtocol(id, staleVersion, userId));
        assertEquals("VERSION_CONFLICT", ex.getCode());
    }

    @Test
    void calculateResult_nullVersion_rejectedAsVersionRequired() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long resultId = firstResultId(id);
        kz.eco.common.exception.BadRequestException ex = assertThrows(
                kz.eco.common.exception.BadRequestException.class,
                () -> calculationService.calculateResult(id, resultId, null, userId));
        assertEquals("VERSION_REQUIRED", ex.getCode());
    }
}
