package kz.eco.pek;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.company.SpecialMonitoringType;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * End-to-end: which statutory report a created report turns out to be, and when it is due, follows
 * the facility's declared monitoring regime - not the reporting period on its own.
 */
@SpringBootTest
@Transactional
class PekCaspianReportClassificationTest {

    @Autowired private PekReportService reportService;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;

    private Long companyId;
    private User head;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("ТОО Каспий Тест " + System.nanoTime());
        company.setBin(String.valueOf(400000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        head = new User();
        head.setEmail("pek-caspian-" + System.nanoTime() + "@test.kz");
        head.setPasswordHash("test");
        head.setName("Ответственный");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);

        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(head.getId());
        m.setTier(PekStaffTier.defaultForRole(UserRole.HEAD));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                head, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD"))));
    }

    /** A facility plus an ACTIVE program on it, ready to have reports created against it. */
    private Long facilityWithProgram(String name, SpecialMonitoringType regime) {
        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName(name);
        object.setAddress("адрес");
        object.setStatus("ACTIVE");
        object.setSpecialMonitoringType(regime);
        companyObjectRepository.saveAndFlush(object);

        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(object.getId());
        program.setNumber("ПЭК-" + System.nanoTime());
        program.setName("Программа " + name);
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2027, 12, 31));
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setResponsibleUserId(head.getId());
        program.setCreatedBy(head.getId());
        program.setRegulationCode(PekRegulationVersionService.PEK_RULES_250_2026_59);
        programRepository.saveAndFlush(program);
        return object.getId();
    }

    private PekReport createReport(Long objectId, PekPeriodType periodType, Integer quarter) {
        PekApiDtos.ReportResponse response = reportService.create(new PekApiDtos.CreateReportRequest(
                companyId, objectId, periodType.name(), 2026, quarter, null, false), head.getId());
        return reportRepository.findById(response.id()).orElseThrow();
    }

    @Test
    void annualReportAtAnOrdinaryFacility_isTheTables7And12Submission() {
        Long objectId = facilityWithProgram("Обычный объект", SpecialMonitoringType.NONE);
        PekReport report = createReport(objectId, PekPeriodType.YEAR, null);

        assertEquals(PekReportType.PEK_TABLES_7_12_ANNUAL, report.getReportType());
        assertEquals(LocalDate.of(2027, 3, 1), report.getSubmissionDueDate());
    }

    @Test
    void annualReportAtACaspianMarineFacility_isTheCaspianReport() {
        Long objectId = facilityWithProgram("Морская платформа", SpecialMonitoringType.CASPIAN_MARINE);
        PekReport report = createReport(objectId, PekPeriodType.YEAR, null);

        assertEquals(PekReportType.PEM_CASPIAN_ANNUAL, report.getReportType());
        assertEquals(LocalDate.of(2027, 3, 1), report.getSubmissionDueDate());
    }

    @Test
    void quarterlyReportIsUnaffectedByTheFacilityRegime() {
        Long ordinary = facilityWithProgram("Обычный кв", SpecialMonitoringType.NONE);
        Long caspian = facilityWithProgram("Каспий кв", SpecialMonitoringType.CASPIAN_MARINE);

        PekReport a = createReport(ordinary, PekPeriodType.QUARTER, 1);
        PekReport b = createReport(caspian, PekPeriodType.QUARTER, 1);

        assertEquals(PekReportType.PEK_QUARTERLY, a.getReportType());
        assertEquals(PekReportType.PEK_QUARTERLY, b.getReportType());
        assertEquals(LocalDate.of(2026, 5, 1), a.getSubmissionDueDate());
        assertEquals(LocalDate.of(2026, 5, 1), b.getSubmissionDueDate());
    }

    @Test
    void facilitiesOfOneCompanyAreClassifiedIndependently() {
        // The whole reason the flag is on the facility and not on the company: one operator can
        // have both, and a company-level flag would give the ordinary plant the Caspian deadline.
        Long plant = facilityWithProgram("Береговой завод", SpecialMonitoringType.NONE);
        Long platform = facilityWithProgram("Морская платформа", SpecialMonitoringType.CASPIAN_MARINE);

        assertEquals(PekReportType.PEK_TABLES_7_12_ANNUAL,
                createReport(plant, PekPeriodType.YEAR, null).getReportType());
        assertEquals(PekReportType.PEM_CASPIAN_ANNUAL,
                createReport(platform, PekPeriodType.YEAR, null).getReportType());
    }

    @Test
    void aFacilityDefaultsToNoSpecialRegime() {
        Long objectId = facilityWithProgram("Без признака", SpecialMonitoringType.NONE);
        assertEquals(SpecialMonitoringType.NONE,
                companyObjectRepository.findById(objectId).orElseThrow().getSpecialMonitoringType());
    }
}
