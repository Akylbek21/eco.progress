package kz.eco.protocol;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.List;

abstract class ProtocolApiTestSupport {

    @Autowired
    protected CompanyRepository companyRepository;

    @Autowired
    protected CompanyObjectRepository companyObjectRepository;

    @Autowired
    protected LaboratoryRepository laboratoryRepository;

    @Autowired
    protected LaboratoryEmployeeRepository laboratoryEmployeeRepository;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected ProtocolTemplateRepository templateRepository;

    protected Long companyId;
    protected Long objectId;
    protected Long laboratoryId;
    protected Long executorId;
    protected String templateApiId = "ambient_air_szz";
    protected User labUser;

    protected void seedProtocolFixtures() {
        ensureTemplate("AMBIENT_AIR_SZZ");

        User user = new User();
        user.setEmail("lab-api-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Lab API Tester");
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);
        labUser = user;

        Company company = new Company();
        company.setName("ТОО Protocol Test");
        company.setBin("990011223344");
        company.setLegalAddress("г. Алматы, ул. Тестовая, 1");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("СЗЗ точка №1");
        object.setAddress("г. Алматы, промзона");
        object.setActivityType("Производство");
        object.setSamplingLocation("СЗЗ, точка №1");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory laboratory = laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue()
                .orElseGet(this::createDefaultLaboratory);
        laboratoryId = laboratory.getId();

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(user.getId());
        employee.setFullName(user.getName());
        employee.setEmail(user.getEmail());
        employee.setPosition("Исполнитель");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        executorId = employee.getId();
    }

    protected void authenticate(User user) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    protected void authenticateLabUser() {
        authenticate(labUser);
    }

    protected void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    private Laboratory createDefaultLaboratory() {
        Laboratory lab = new Laboratory();
        lab.setName("Test Laboratory");
        lab.setLegalName("ТОО Test Laboratory");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.TEST.001");
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(true);
        lab.setActive(true);
        return laboratoryRepository.save(lab);
    }

    private void ensureTemplate(String code) {
        if (templateRepository.findByCode(code).isEmpty()) {
            ProtocolTemplateCode templateCode = ProtocolTemplateCode.valueOf(code);
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode(code);
            template.setName(templateCode.title());
            template.setDescription(templateCode.title());
            template.setFormCode(templateCode.numberPrefix());
            template.setActive(true);
            templateRepository.save(template);
        }
    }

    protected String createProtocolJson() {
        String today = LocalDate.now().toString();
        return """
                {
                  "templateId": "%s",
                  "companyId": %d,
                  "objectId": %d,
                  "protocolDate": "%s",
                  "sampleDate": "%s",
                  "testingStartDate": "%s",
                  "testingEndDate": "%s",
                  "measurementPlace": "СЗЗ, точка №1",
                  "laboratoryId": %d,
                  "executorId": %d,
                  "environment": {
                    "temperatureC": 31.4,
                    "humidityPercent": 29,
                    "pressureKpa": 94.79,
                    "windSpeedMs": 3.2,
                    "conditionsComment": "Ясно"
                  }
                }
                """.formatted(templateApiId, companyId, objectId, today, today, today, today, laboratoryId, executorId);
    }

    protected String normalResultJson() {
        return """
                {
                  "code": "0301",
                  "pollutantCode": "0301",
                  "indicatorName": "Азота диоксид",
                  "casNumber": "10102-44-0",
                  "formula": "NO2",
                  "normativeType": "PDK",
                  "normativeSubType": "MAX_ONE_TIME",
                  "normativeValue": "0.2",
                  "unit": "мг/м³",
                  "comparisonType": "LESS_OR_EQUAL",
                  "primaryReading": "0.13",
                  "measurementReadings": ["0.13"]
                }
                """;
    }

    protected String exceededResultJson() {
        return """
                {
                  "indicatorName": "Азота диоксид",
                  "normativeValue": "0.2",
                  "unit": "мг/м³",
                  "comparisonType": "LESS_OR_EQUAL",
                  "primaryReading": "0.25",
                  "result": "0.25"
                }
                """;
    }
}
