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

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ProtocolServiceTest {

    @Autowired
    private ProtocolService protocolService;

    @Autowired
    private ProtocolTemplateRepository templateRepository;

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
    private ProtocolRepository protocolRepository;
    @Autowired
    private MeasurementDeviceRepository deviceRepository;
    @Autowired
    private ProtocolResultRepository resultRepository;

    private String templateCode = "AMBIENT_AIR_SZZ";
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
        user.setEmail("lab-test-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Lab Tester");
        user.setRole(UserRole.LABORATORY);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Test");
        company.setBin("001122334455");
        company.setLegalAddress("Старый адрес");
        company.setPhone("+77000000000");
        company.setStatus(CompanyStatus.ACTIVE);
        company.setObjectName("Цех №1");
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех №1");
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

    @Test
    void createProtocol_withoutOrderId() {
        ProtocolApiDtos.ProtocolResponse created = protocolService.create(createRequest(), userId);
        assertNotNull(created.id());
        assertTrue(created.number().startsWith("VRZ-"));
        assertEquals("DRAFT", created.status());
    }

    @Test
    void create_withPrintVisibility_persistsProvidedFieldsAndDefaultsRestToVisible() {
        ProtocolApiDtos.ProtocolPrintVisibility visibility = new ProtocolApiDtos.ProtocolPrintVisibility(
                false, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null);
        ProtocolApiDtos.ProtocolResponse created = protocolService.create(createRequest(visibility), userId);

        assertNotNull(created.printVisibility(), "response must always carry a print-visibility block");
        assertEquals(Boolean.FALSE, created.printVisibility().organizationName(),
                "explicitly hidden field must be stored as hidden");
        assertEquals(Boolean.TRUE, created.printVisibility().organizationAddress(),
                "untouched field must default to visible");
        assertEquals(Boolean.TRUE, created.printVisibility().productName(),
                "untouched field must default to visible");
    }

    @Test
    void update_printVisibility_partiallyMergesWithoutResettingUntouchedFields() {
        ProtocolApiDtos.ProtocolResponse created = protocolService.create(createRequest(), userId);
        Long id = Long.parseLong(created.id());
        assertEquals(Boolean.TRUE, created.printVisibility().organizationName(),
                "brand new protocol must default every field to visible");

        ProtocolApiDtos.ProtocolResponse afterHidingOrgName = protocolService.update(id,
                updateRequestWithVisibility(new ProtocolApiDtos.ProtocolPrintVisibility(
                        false, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null)),
                userId);
        assertEquals(Boolean.FALSE, afterHidingOrgName.printVisibility().organizationName());

        ProtocolApiDtos.ProtocolResponse afterNoOpUpdate = protocolService.update(id,
                updateRequestWithVisibility(null), userId);
        assertEquals(Boolean.FALSE, afterNoOpUpdate.printVisibility().organizationName(),
                "an update that omits printVisibility must not reset a previously hidden field back to visible");

        ProtocolApiDtos.ProtocolResponse afterHidingTestBasis = protocolService.update(id,
                updateRequestWithVisibility(new ProtocolApiDtos.ProtocolPrintVisibility(
                        null, null, null, null, false, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null)),
                userId);
        assertEquals(Boolean.FALSE, afterHidingTestBasis.printVisibility().organizationName(),
                "earlier hidden field must stay hidden across an unrelated PATCH");
        assertEquals(Boolean.FALSE, afterHidingTestBasis.printVisibility().testBasis());
        assertEquals(Boolean.TRUE, afterHidingTestBasis.printVisibility().productName(),
                "field never touched by any update must remain visible");

        ProtocolApiDtos.ProtocolResponse afterShowingOrgName = protocolService.update(id,
                updateRequestWithVisibility(new ProtocolApiDtos.ProtocolPrintVisibility(
                        true, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null)),
                userId);
        assertEquals(Boolean.TRUE, afterShowingOrgName.printVisibility().organizationName(),
                "setting includeInProtocol=true must make the field visible again");
        assertEquals(Boolean.FALSE, afterShowingOrgName.printVisibility().testBasis(),
                "re-showing one field must not affect another still-hidden field");
    }

    @Test
    void update_acceptsFlatTestingMethodDocument_andGetReturnsItNested() {
        ProtocolApiDtos.ProtocolResponse created = protocolService.create(createRequest(), userId);
        Long id = Long.parseLong(created.id());

        ProtocolApiDtos.UpdateProtocolRequest flatUpdate = new ProtocolApiDtos.UpdateProtocolRequest(
                null, null, null, null, null, null, null, null, null,
                "ГОСТ 33045-2014 \"Вода. Методы определения азотсодержащих веществ\"",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

        ProtocolApiDtos.ProtocolResponse updated = protocolService.update(id, flatUpdate, userId);

        assertEquals("ГОСТ 33045-2014 \"Вода. Методы определения азотсодержащих веществ\"",
                updated.testing().testingMethodDocument());
        ProtocolApiDtos.ProtocolResponse reloaded = protocolService.get(id);
        assertEquals("ГОСТ 33045-2014 \"Вода. Методы определения азотсодержащих веществ\"",
                reloaded.testing().testingMethodDocument());
    }

    @Test
    void update_nestedTestingMethodDocument_takesPriorityOverFlat() {
        ProtocolApiDtos.ProtocolResponse created = protocolService.create(createRequest(), userId);
        Long id = Long.parseLong(created.id());

        ProtocolApiDtos.TestingData nested = new ProtocolApiDtos.TestingData(
                null, null, "НД из nested testing", null, null, null, null, null);
        ProtocolApiDtos.UpdateProtocolRequest request = new ProtocolApiDtos.UpdateProtocolRequest(
                null, null, null, null, null, null, null, null, nested,
                "НД из flat поля",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

        ProtocolApiDtos.ProtocolResponse updated = protocolService.update(id, request, userId);

        assertEquals("НД из nested testing", updated.testing().testingMethodDocument());
    }

    @Test
    void listTemplates_returnsTheEightCanonicalRegistryTypes() {
        List<ProtocolApiDtos.ProtocolTemplateResponse> templates = protocolService.listTemplates();
        assertEquals(8, templates.size(), "one entry per ProtocolTypeRegistry type, not per legacy DB template code");
        assertTrue(templates.stream().allMatch(ProtocolApiDtos.ProtocolTemplateResponse::active));
    }

    @Test
    void protocolNumber_increments() {
        var req = createRequest();
        String n1 = protocolService.create(req, userId).number();
        String n2 = protocolService.create(req, userId).number();
        assertNotEquals(n1, n2);
    }

    /** ProtocolService.sign() now requires an actually-valid CMS signature covering the exact PDF
     *  bytes (spec §23) - a null/plain-marker "signature" is no longer accepted. Generates a real
     *  self-signed CMS over the protocol's current PDF via TestCmsSigner so tests still exercise
     *  the real verification path. */
    private ProtocolApiDtos.ProtocolResponse signWithRealCms(Long id, Long actingUserId) throws Exception {
        byte[] pdfBytes = protocolService.downloadPdf(id, actingUserId).inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        return protocolService.sign(id, new ProtocolApiDtos.SignProtocolRequest(cms), actingUserId);
    }

    @Test
    void signedProtocol_cannotBeEdited() throws Exception {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        protocolService.update(Long.parseLong(p.id()), fullUpdate(), userId);
        protocolService.readyForApproval(Long.parseLong(p.id()), userId);
        protocolService.approve(Long.parseLong(p.id()), userId);
        signWithRealCms(Long.parseLong(p.id()), userId);

        assertThrows(Exception.class, () -> protocolService.update(Long.parseLong(p.id()), fullUpdate(), userId));
    }

    @Test
    void replace_createsNewDraft() throws Exception {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        protocolService.update(Long.parseLong(p.id()), fullUpdate(), userId);
        protocolService.readyForApproval(Long.parseLong(p.id()), userId);
        protocolService.approve(Long.parseLong(p.id()), userId);
        signWithRealCms(Long.parseLong(p.id()), userId);

        ProtocolApiDtos.ProtocolResponse replacement = protocolService.replace(
                Long.parseLong(p.id()), new ProtocolApiDtos.ReplaceProtocolRequest("Опечатка", null), userId);
        assertEquals("DRAFT", replacement.status());
        assertEquals(p.id(), replacement.replacesProtocolId());
        assertNotEquals(p.number(), replacement.number());
    }

    @Test
    void replace_copiesPrintVisibilityAndDeviceBindingToTheNewDraft() throws Exception {
        MeasurementDevice device = new MeasurementDevice();
        device.setName("Газоанализатор ГАНК-4");
        device.setSerialNumber("12547");
        device.setVerificationValidUntil(LocalDate.now().plusYears(1));
        device = deviceRepository.save(device);

        ProtocolApiDtos.ProtocolResponse p = protocolService.create(createRequest(
                new ProtocolApiDtos.ProtocolPrintVisibility(
                        false, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null)),
                userId);
        Map<String, Object> resultBody = new java.util.HashMap<>(Map.of(
                "indicator", "Пыль",
                "unit", "мг/м³",
                "result", 1.5,
                "samplingPlace", "Место 1",
                "pdk", 4.0,
                "measurementDeviceId", device.getId()
        ));
        protocolService.addResult(Long.parseLong(p.id()), resultBody, userId);
        protocolService.update(Long.parseLong(p.id()), fullUpdate(), userId);
        protocolService.readyForApproval(Long.parseLong(p.id()), userId);
        protocolService.approve(Long.parseLong(p.id()), userId);
        signWithRealCms(Long.parseLong(p.id()), userId);

        ProtocolApiDtos.ProtocolResponse replacement = protocolService.replace(
                Long.parseLong(p.id()), new ProtocolApiDtos.ReplaceProtocolRequest("Опечатка", null), userId);

        assertEquals(Boolean.FALSE, replacement.printVisibility().organizationName(),
                "print-visibility settings must survive a clone/replace");
        List<ProtocolResult> replacedResults = resultRepository.findByProtocolIdOrderByRowNumberAsc(Long.parseLong(replacement.id()));
        assertEquals(1, replacedResults.size());
        assertEquals(device.getId(), replacedResults.get(0).getDeviceId(),
                "the measurement-device binding on a result must survive a clone/replace");
        assertNotNull(replacedResults.get(0).getValuesJson(),
                "the device snapshot (name/model/serial) living in valuesJson must survive a clone/replace too");
    }

    @Test
    void generatePreview_returnsPdfBytes() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        byte[] pdf = protocolService.preview(Long.parseLong(p.id()));
        assertTrue(pdf.length > 100);
        assertEquals('%', (char) pdf[0]);
    }

    @Test
    void readyForApproval_requiresResults() {
        ProtocolApiDtos.ProtocolResponse p = protocolService.create(createRequest(), userId);
        assertThrows(Exception.class, () -> protocolService.readyForApproval(Long.parseLong(p.id()), userId));
    }

    @Test
    void protocol_keepsCompanySnapshotAfterCompanyUpdate() {
        ProtocolApiDtos.ProtocolResponse protocol = protocolService.create(createRequest(), userId);
        Company company = companyRepository.findById(companyId).orElseThrow();
        company.setLegalAddress("Новый адрес");
        companyRepository.save(company);

        Protocol saved = protocolRepository.findById(Long.parseLong(protocol.id())).orElseThrow();
        assertEquals("Старый адрес", saved.getCompanyLegalAddressSnapshot());
    }

    @Test
    void cannotCreateProtocolForArchivedCompany() {
        Company company = companyRepository.findById(companyId).orElseThrow();
        company.setStatus(CompanyStatus.ARCHIVED);
        companyRepository.save(company);
        assertThrows(Exception.class, () -> protocolService.create(createRequest(), userId));
    }

    @Test
    void returnToDraft_fromReadyForApproval() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        protocolService.update(Long.parseLong(p.id()), fullUpdate(), userId);
        protocolService.readyForApproval(Long.parseLong(p.id()), userId);
        ProtocolApiDtos.ProtocolResponse draft = protocolService.returnToDraft(Long.parseLong(p.id()), userId);
        assertEquals("DRAFT", draft.status());
    }

    @Test
    void addResult_readsPrimaryReadingAsResult() {
        ProtocolApiDtos.ProtocolResponse p = protocolService.create(createRequest(), userId);
        Map<String, Object> row = protocolService.addResult(Long.parseLong(p.id()),
                new ProtocolApiDtos.ResultRow(null, null, null, Map.of(
                        "indicator", "Сульфаты",
                        "unit", "мг/дм³",
                        "primaryReading", 12.5
                )), userId);
        @SuppressWarnings("unchecked")
        Map<String, Object> values = (Map<String, Object>) row.get("values");
        assertEquals("12.5", String.valueOf(values.get("result")));
        assertNotNull(values.get("primaryReading"));
    }

    private ProtocolApiDtos.CreateProtocolRequest createRequest() {
        return createRequest(null);
    }

    private ProtocolApiDtos.CreateProtocolRequest createRequest(ProtocolApiDtos.ProtocolPrintVisibility visibility) {
        return new ProtocolApiDtos.CreateProtocolRequest(
                templateCode,
                companyId,
                objectId,
                null,
                LocalDate.now().toString(),
                LocalDate.now().toString(),
                LocalDate.now().toString(),
                LocalDate.now().toString(),
                LocalDate.now().toString(),
                LocalDate.now().toString(),
                "Контроль",
                "Контроль",
                "Контроль",
                "20°C",
                "20°C",
                "Продукция",
                "Договор",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                laboratoryId,
                executorId,
                visibility
        );
    }

    private static ProtocolApiDtos.UpdateProtocolRequest updateRequestWithVisibility(
            ProtocolApiDtos.ProtocolPrintVisibility visibility) {
        return new ProtocolApiDtos.UpdateProtocolRequest(
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, visibility, null
        );
    }

    private ProtocolApiDtos.ProtocolResponse createDraftWithResult() {
        ProtocolApiDtos.ProtocolResponse p = protocolService.create(createRequest(), userId);
        protocolService.addResult(Long.parseLong(p.id()), new ProtocolApiDtos.ResultRow(
                null, null, null,
                Map.of(
                        "indicator", "Пыль",
                        "unit", "мг/м³",
                        "result", 1.5,
                        "samplingPlace", "Место 1",
                        "pdk", 4.0
                )
        ), userId);
        return p;
    }

    private static ProtocolApiDtos.UpdateProtocolRequest fullUpdate() {
        return new ProtocolApiDtos.UpdateProtocolRequest(
                null,
                LocalDate.now().toString(),
                null,
                "Исполнитель",
                null,
                "Зав. лаб.",
                new ProtocolApiDtos.LaboratoryData(
                        null, null,
                        "Лаборатория", "Лаборатория",
                        null, null,
                        "Адрес", "Адрес",
                        null, null,
                        "KZ.А.123",
                        null,
                        LocalDate.now().plusYears(1).toString(),
                        null,
                        "Директор", "Директор",
                        null,
                        "Зав. лаб.", "Зав. лаб.",
                        null, null, "Исполнитель",
                        null, null, null
                ),
                new ProtocolApiDtos.OrganizationData(
                        "ТОО Test", "Адрес", "Объект", "Продукция", "Договор"
                ),
                new ProtocolApiDtos.TestingData(
                        "НД прод", "НД отбор", "НД испыт",
                        LocalDate.now().minusDays(2).toString(),
                        LocalDate.now().minusDays(1).toString(),
                        "Контроль", "20°C", null
                ),
                null,
                null,
                List.of(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }
}
