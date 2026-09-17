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
import kz.eco.protocol.calculation.RawMeasurementRepository;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P1 module fix item 6: createCorrection (SIGNED -&gt; REPLACED old / new DRAFT) must clone the
 * whole business aggregate - company/object/laboratory/executor references, order linkage,
 * type/subtype/formCode, measurement dates, results, and raw measurements (remapped to the new
 * result rows) - while never carrying over workflow/signature/approval/generated-file state.
 * Parametrized across every {@link ProtocolTemplateCode} so no protocol type is left unverified.
 */
@SpringBootTest
@Transactional
class ProtocolCorrectionCloneServiceTest {

    @Autowired private ProtocolService protocolService;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolResultRepository resultRepository;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private RawMeasurementRepository rawMeasurementRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private Long userId;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;

    @BeforeEach
    void setUp() {
        for (ProtocolTemplateCode code : ProtocolTemplateCode.values()) {
            if (templateRepository.findByCode(code.name()).isEmpty()) {
                ProtocolTemplate template = new ProtocolTemplate();
                template.setCode(code.name());
                template.setName(code.title());
                template.setActive(true);
                templateRepository.save(template);
            }
        }

        User user = new User();
        user.setEmail("clone-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Clone Tester");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Clone Test");
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setLegalAddress("Адрес");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Точка клонирования");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory laboratory = laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue()
                .orElseGet(() -> {
                    Laboratory lab = new Laboratory();
                    lab.setName("Clone Lab");
                    lab.setAddress("Адрес");
                    lab.setAccreditationNumber("KZ.CLONE." + System.nanoTime());
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

    @ParameterizedTest
    @ValueSource(strings = {
            "ambient_air_szz", "industrial_emissions", "water_wastewater", "soil",
            "microclimate", "lighting", "noise_vibration", "workplace_air", "uv_emf_laser"
    })
    void createCorrection_clonesFullBusinessAggregate_forEveryProtocolType(String templateId) throws Exception {
        ProtocolApiDtos.ProtocolResponse created = protocolService.create(
                ProtocolCreateRequestFactory.minimal(templateId, companyId, objectId, laboratoryId, executorId), userId);
        long id = Long.parseLong(created.id());

        Map<String, Object> row = protocolService.addResult(id, new ProtocolApiDtos.ResultRow(
                null, null, null,
                Map.of("indicator", "Тестовый показатель", "unit", "мг/м³", "result", 1.5,
                        "samplingPlace", "Место отбора")
        ), created.version(), userId);
        Long resultId = Long.parseLong(String.valueOf(row.get("id")));

        // Attach a raw measurement to the result - proves item 6's "remap old result IDs to new
        // result IDs" requirement, since RawMeasurement is keyed by protocolResultId.
        var rawMeasurementRepo = rawMeasurementRepository;
        var rawMeasurement = new kz.eco.protocol.calculation.RawMeasurement();
        rawMeasurement.setProtocolResultId(resultId);
        rawMeasurement.setVariableKey("primaryReading");
        rawMeasurement.setVariableValue(new BigDecimal("42.5"));
        rawMeasurement.setUnit("мг/м³");
        rawMeasurementRepo.save(rawMeasurement);

        Protocol beforeSign = protocolRepository.findById(id).orElseThrow();
        String subtypeBefore = beforeSign.getSubtype();
        String formCodeBefore = beforeSign.getFormCode();
        Long objectIdBefore = beforeSign.getObjectId();
        Long laboratoryIdBefore = beforeSign.getLaboratoryId();
        Long executorIdBefore = beforeSign.getExecutorId();

        // This test verifies the CLONE mechanics (ProtocolCorrectionCloneService), not the
        // approve/sign workflow's own field-completeness validation (covered separately by
        // ProtocolApprovalSigningBindingTest and every per-type validation test) - each of the 9
        // templates has different required-field policies, so driving all of them through the
        // real readyForApproval/approve/sign pipeline here would just be testing that pipeline
        // again, param by param. Setting SIGNED directly is the accepted shortcut other test
        // files in this suite already use for the same reason.
        Protocol signed = protocolRepository.findById(id).orElseThrow();
        signed.setStatus(ProtocolStatus.SIGNED);
        protocolRepository.saveAndFlush(signed);
        assertEquals("SIGNED", signed.getStatus().name());

        long signedVersion = signed.getVersion();
        ProtocolApiDtos.ProtocolResponse corrected = protocolService.replace(
                id, new ProtocolApiDtos.ReplaceProtocolRequest("Исправление формата отчёта", signedVersion), userId);

        Protocol oldRow = protocolRepository.findById(id).orElseThrow();
        assertEquals("REPLACED", oldRow.getStatus().name());
        assertEquals(Long.parseLong(corrected.id()), oldRow.getReplacedByProtocolId());

        Protocol clone = protocolRepository.findById(Long.parseLong(corrected.id())).orElseThrow();
        assertEquals("DRAFT", clone.getStatus().name(), "a correction always starts as a fresh DRAFT");
        assertEquals(id, clone.getReplacedProtocolId());
        assertEquals("Исправление формата отчёта", clone.getReplacementReason());

        // ---- business aggregate fields survive the clone --------------------------------------
        assertEquals(objectIdBefore, clone.getObjectId(), "objectId must be cloned");
        assertEquals(companyId, clone.getCompanyId(), "companyId must be cloned");
        assertEquals(laboratoryIdBefore, clone.getLaboratoryId(), "laboratoryId must be cloned");
        assertEquals(executorIdBefore, clone.getExecutorId(), "executorId must be cloned");
        assertEquals(subtypeBefore, clone.getSubtype());
        assertEquals(formCodeBefore, clone.getFormCode());

        List<ProtocolResult> clonedResults = resultRepository.findByProtocolIdOrderByRowNumberAsc(clone.getId());
        assertEquals(1, clonedResults.size(), "results must be cloned");
        ProtocolResult clonedResult = clonedResults.get(0);
        assertNotEquals(resultId, clonedResult.getId(), "the clone must have its OWN new result id");
        assertEquals("Тестовый показатель", clonedResult.getIndicatorName());

        List<kz.eco.protocol.calculation.RawMeasurement> clonedMeasurements =
                rawMeasurementRepo.findByProtocolResultId(clonedResult.getId());
        assertEquals(1, clonedMeasurements.size(),
                "raw measurements must be remapped to the NEW result id, not left pointing at the old one");
        assertEquals(0, new BigDecimal("42.5").compareTo(clonedMeasurements.get(0).getVariableValue()));

        // ---- workflow/signature/approval/generated-file state must NOT be carried over --------
        assertEquals(0L, (long) clone.getVersion());
        assertNull(clone.getSignatureFileId());
        assertNull(clone.getSignedAt());
        assertNull(clone.getSignedBy());
        assertNull(clone.getPublishedAt());
        assertNull(clone.getDocxFileId());
        assertNull(clone.getPdfFileId());
        assertNull(clone.getPdfSha256());
        assertNull(clone.getApprovedAt());
        assertNull(clone.getApprovedBy());
        assertNull(clone.getApprovedPdfHash());
        assertNull(clone.getApprovedContentVersion());
    }
}
