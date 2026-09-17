package kz.eco.protocol;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.pek.PekControlType;
import kz.eco.pek.PekFrequencyType;
import kz.eco.pek.PekMembershipStatus;
import kz.eco.pek.PekMonitoringPoint;
import kz.eco.pek.PekMonitoringPointRepository;
import kz.eco.pek.PekMonitoringType;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekProgramControlItem;
import kz.eco.pek.PekProgramControlItemRepository;
import kz.eco.pek.PekProgramIndicator;
import kz.eco.pek.PekProgramIndicatorRepository;
import kz.eco.pek.PekProgramMonitoring;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekProgramStatus;
import kz.eco.pek.PekStaffAssignment;
import kz.eco.pek.PekStaffAssignmentRepository;
import kz.eco.pek.PekStaffTier;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

/**
 * Builds a REAL, fully wired ПЭК programme (company, object, approved+active programme, monitoring
 * direction, control item with a real frequency, monitoring point, programme indicator) plus a
 * protocol template and laboratory - the actual data the creation-context/from-ПЭК endpoints read.
 * Nothing here is stubbed or mocked; every row goes through the normal repositories.
 */
@Component
public class PekProgramTestFixture {

    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekMonitoringPointRepository pointRepository;
    @Autowired private PekProgramIndicatorRepository indicatorRepository;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;

    public record Fixture(Long companyId, Long objectId, Long programId, Long monitoringId,
                           Long controlItemId, Long pointId, Long indicatorId, Long laboratoryId) {}

    public Company company(String name) {
        Company company = new Company();
        company.setName(name + " " + System.nanoTime());
        company.setBin(String.valueOf(100000000000L + Math.abs(System.nanoTime() % 899999999999L)));
        company.setLegalAddress("г. Алматы, ул. Тестовая, 1");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        return companyRepository.save(company);
    }

    public CompanyObject object(Long companyId, String name) {
        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName(name);
        object.setAddress("г. Алматы, промзона");
        object.setActivityType("Производство");
        object.setStatus("ACTIVE");
        return companyObjectRepository.save(object);
    }

    public User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@ecoprogress.kz");
        u.setPasswordHash("x");
        u.setName("Test " + role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        u.setIin("990101300123");
        return userRepository.save(u);
    }

    public void membership(Long companyId, User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    public Laboratory laboratory() {
        return laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue().orElseGet(() -> {
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
        });
    }

    public ProtocolTemplate template(ProtocolTemplateCode code) {
        return templateRepository.findByCode(code.name()).orElseGet(() -> {
            ProtocolTemplate t = new ProtocolTemplate();
            t.setCode(code.name());
            t.setName(code.title());
            t.setDescription(code.title());
            t.setFormCode(code.numberPrefix());
            t.setActive(true);
            return templateRepository.save(t);
        });
    }

    /** The default fixture: an ACTIVE programme valid for the whole of {@code year}, one AMBIENT_AIR
     *  direction, one QUARTERLY control item planned once per quarter, one monitoring point, one
     *  indicator. */
    public Fixture standard(int year, UserRole ownerRole, User owner) {
        return standard(year, owner, PekFrequencyType.QUARTERLY, 1, PekProgramStatus.ACTIVE, true);
    }

    public Fixture standard(int year, User owner, PekFrequencyType frequency, int frequencyValue,
                             PekProgramStatus status, boolean withIndicator) {
        Company company = company("ТОО ПЭК-протокол");
        CompanyObject object = object(company.getId(), "Промплощадка №1");
        membership(company.getId(), owner);
        return programFor(company.getId(), object.getId(), year, owner, frequency, frequencyValue,
                status, withIndicator);
    }

    public Fixture programFor(Long companyId, Long objectId, int year, User owner,
                               PekFrequencyType frequency, int frequencyValue,
                               PekProgramStatus status, boolean withIndicator) {
        Laboratory lab = laboratory();
        template(ProtocolTemplateCode.AMBIENT_AIR_SZZ);

        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("ПЭК-" + Math.abs(System.nanoTime() % 100000));
        program.setName("Программа ПЭК " + year);
        program.setValidFrom(LocalDate.of(year, 1, 1));
        program.setValidUntil(LocalDate.of(year, 12, 31));
        program.setStatus(status);
        program.setResponsibleUserId(owner.getId());
        program.setCreatedBy(owner.getId());
        programRepository.saveAndFlush(program);

        PekProgramControlItem item = new PekProgramControlItem();
        item.setProgramId(program.getId());
        item.setCode("AIR-1");
        item.setName("Контроль атмосферного воздуха на границе СЗЗ");
        item.setControlType(PekControlType.EMISSION);
        item.setEnvironmentComponent("Атмосферный воздух");
        item.setFrequencyType(frequency);
        item.setFrequencyValue(frequencyValue);
        item.setLaboratoryId(lab.getId());
        item.setActive(true);
        controlItemRepository.saveAndFlush(item);

        PekProgramMonitoring monitoring = new PekProgramMonitoring();
        monitoring.setProgramId(program.getId());
        monitoring.setMonitoringType(PekMonitoringType.AMBIENT_AIR);
        monitoring.setName("Атмосферный воздух / СЗЗ");
        monitoring.setMethodology("МУК 4.1.2468-09");
        monitoring.setLaboratoryId(lab.getId());
        monitoring.setFrequencyType(frequency);
        monitoring.setActive(true);
        monitoring.setControlItemIds(Set.of(item.getId()));
        monitoringRepository.saveAndFlush(monitoring);

        PekMonitoringPoint point = new PekMonitoringPoint();
        point.setMonitoringId(monitoring.getId());
        point.setProgramId(program.getId());
        point.setName("Источник №1");
        pointRepository.saveAndFlush(point);

        Long indicatorId = null;
        if (withIndicator) {
            PekProgramIndicator indicator = new PekProgramIndicator();
            indicator.setProgramId(program.getId());
            indicator.setControlItemId(item.getId());
            indicator.setIndicatorName("Азота диоксид");
            indicator.setUnit("мг/м³");
            indicator.setNormativeValue(new BigDecimal("0.2"));
            indicator.setComparisonType(ComparisonType.LESS_OR_EQUAL);
            indicatorRepository.saveAndFlush(indicator);
            indicatorId = indicator.getId();
        }

        return new Fixture(companyId, objectId, program.getId(), monitoring.getId(), item.getId(),
                point.getId(), indicatorId, lab.getId());
    }
}
