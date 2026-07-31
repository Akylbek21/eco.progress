package kz.eco.company;

import kz.eco.company.dto.CompanyDtos;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.protocol.ProtocolCreateRequestFactory;
import kz.eco.protocol.ProtocolService;
import kz.eco.protocol.ProtocolCreateRequestFactory;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class CompanyServiceTest {

    @Autowired
    private CompanyService companyService;
    @Autowired
    private CompanyRepository companyRepository;
    @Autowired
    private ProtocolService protocolService;
    @Autowired
    private ProtocolTemplateRepository templateRepository;
    @Autowired
    private CompanyObjectRepository companyObjectRepository;
    @Autowired
    private LaboratoryRepository laboratoryRepository;
    @Autowired
    private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private Long userId;
    private String templateCode = "AMBIENT_AIR_SZZ";

    @BeforeEach
    void setup() {
        if (templateRepository.findByCode("AMBIENT_AIR_SZZ").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("AMBIENT_AIR_SZZ");
            template.setName("Атмосферный воздух / СЗЗ");
            template.setActive(true);
            templateRepository.save(template);
        }
        templateCode = templateRepository.findByCode("AMBIENT_AIR_SZZ").orElseThrow().getCode();

        User user = new User();
        user.setEmail("manager-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Manager Tester");
        user.setRole(UserRole.MANAGER);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();
    }

    @Test
    void createAndSearchAndUpdateAndArchiveCompany() {
        CompanyDtos.CompanyDto created = companyService.create(validCreate("ТОО Test", "001234567890"), userId);
        assertNotNull(created.id());
        assertEquals(CompanyStatus.ACTIVE, created.status());

        assertFalse(companyService.list("Test", CompanyStatus.ACTIVE, 0, 20, null).items().isEmpty());
        assertFalse(companyService.search("Test").isEmpty());
        assertFalse(companyService.search("001234567890").isEmpty());

        CompanyDtos.CompanyDto loaded = companyService.get(created.id());
        assertEquals("ТОО Test", loaded.name());

        CompanyDtos.CompanyDto updated = companyService.update(created.id(),
                new CompanyDtos.UpdateCompanyRequest(
                        "ТОО Test Updated", null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null
                ), userId);
        assertEquals("ТОО Test Updated", updated.name());

        CompanyDtos.CompanyDto archived = companyService.archive(created.id(), userId);
        assertEquals(CompanyStatus.ARCHIVED, archived.status());
    }

    @Test
    void createCompanyValidationFailsForRequiredFields() {
        kz.eco.common.exception.ValidationException ex = assertThrows(
                kz.eco.common.exception.ValidationException.class,
                () -> companyService.create(validCreate("", ""), userId));
        assertTrue(ex.getFieldErrors().containsKey("name") || ex.getFieldErrors().containsKey("bin"));
    }

    @Test
    void deleteUsedCompanyArchivesIt() {
        CompanyDtos.CompanyDto company = companyService.create(validCreate("ТОО Used", "000111222333"), userId);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.id());
        object.setName("Объект");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

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

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratory.getId());
        employee.setUserId(userId);
        employee.setFullName("Manager Tester");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);

        protocolService.create(ProtocolCreateRequestFactory.minimal(
                templateCode, company.id(), object.getId(), laboratory.getId(), employee.getId()), userId);

        String message = companyService.delete(company.id(), userId);
        Company reloaded = companyRepository.findById(company.id()).orElseThrow();
        assertEquals("Компания использовалась в протоколах и была архивирована", message);
        assertEquals(CompanyStatus.ARCHIVED, reloaded.getStatus());
    }

    @Test
    void createCompany_alsoCreatesRealPrimaryObject() {
        CompanyDtos.CompanyDto company = companyService.create(validCreate("ТОО Objects", "000222333444"), userId);
        List<CompanyDtos.CompanyObjectDto> objects = companyService.listObjects(company.id(), false);
        assertEquals(1, objects.size());
        assertNotNull(objects.getFirst().id());
        assertTrue(objects.getFirst().primary());
        assertEquals(company.id(), objects.getFirst().companyId());
    }

    @Test
    void companyWithNoObjects_isSelfHealedOnRead() {
        CompanyDtos.CompanyDto company = companyService.create(validCreate("ТОО Без объектов", "000333444555"), userId);
        // Simulate pre-migration data: a company somehow left with zero company_objects rows.
        companyObjectRepository.findByCompanyIdOrderByNameAsc(company.id())
                .forEach(o -> companyObjectRepository.deleteById(o.getId()));
        assertTrue(companyObjectRepository.findByCompanyIdOrderByNameAsc(company.id()).isEmpty());

        List<CompanyDtos.CompanyObjectDto> objects = companyService.listObjects(company.id(), false);
        assertEquals(1, objects.size());
        assertTrue(objects.getFirst().primary());
        assertTrue(companyObjectRepository.findById(objects.getFirst().id()).isPresent(),
                "materialized object must be a real, persisted company_objects row");
    }

    private CompanyDtos.CreateCompanyRequest validCreate(String name, String bin) {
        return new CompanyDtos.CreateCompanyRequest(
                name, bin, "Юр адрес", null, "+77000000000", "test@eco.kz", null, null,
                "Директор", "Ген директор", "Ответственный", "+77000000001",
                "Банк", "KZ123456789012345678", "HSBKKZKX", "17", "911",
                "1/2026", LocalDate.now(), "Объект", "Адрес объекта",
                "Деятельность", "Точка отбора", "Представитель"
        );
    }
}
