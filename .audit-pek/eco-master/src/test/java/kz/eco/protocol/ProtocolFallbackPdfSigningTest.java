package kz.eco.protocol;

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
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Module spec item 6: never allow signing a PDF produced by the OpenPDF fallback renderer
 * (LibreOffice unavailable/failed) - separate test class (rather than a method in
 * ProtocolSigningHardeningTest) because it needs its own Spring context with
 * protocol.signing.block-fallback-pdf overridden back to true; the rest of this suite runs with it
 * off (see src/test/resources/application.properties) since this test environment has no
 * LibreOffice at all and every other sign test needs fallback-PDF signing to keep working.
 */
@SpringBootTest
@Transactional
@TestPropertySource(properties = "protocol.signing.block-fallback-pdf=true")
class ProtocolFallbackPdfSigningTest {

    @Autowired private ProtocolService protocolService;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolDocumentGenerationService documentService;

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
        user.setEmail("fallback-pdf-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Fallback PDF Tester");
        // Module fix item 5: signing requires the formal APPROVED review path, supervisor-only.
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        user.setIin("990101300123");
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Fallback PDF");
        company.setBin("222333444555");
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

    private Long createSignableProtocol() {
        ProtocolApiDtos.ProtocolResponse p = protocolService.create(new ProtocolApiDtos.CreateProtocolRequest(
                templateCode, companyId, objectId, null,
                LocalDate.now().toString(), LocalDate.now().toString(), LocalDate.now().toString(),
                LocalDate.now().toString(), LocalDate.now().toString(), LocalDate.now().toString(),
                "Контроль", "Контроль", "Контроль", "20°C", "20°C", "Продукция", "Договор",
                null, null, null, null, null, null, null, null, null, null, null,
                laboratoryId, executorId, null, null, null), userId);
        long id = Long.parseLong(p.id());
        protocolService.addResult(id, new ProtocolApiDtos.ResultRow(
                null, null, null,
                Map.of("indicator", "Пыль", "pollutantCode", "0301", "unit", "мг/м³", "result", 1.5,
                        "samplingPlace", "Место 1", "pdk", 4.0)
        ), p.version(), userId);
        ProtocolApiDtos.TestingData testing = new ProtocolApiDtos.TestingData(
                null, null, "МУК 4.1.2468-09", null, null, null, null, null);
        Long v1 = protocolRepository.findById(id).orElseThrow().getVersion();
        ProtocolApiDtos.UpdateProtocolRequest update = new ProtocolApiDtos.UpdateProtocolRequest(
                null, null, null, null, null, null, null, null, testing, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                "СЗЗ, точка №1", null, null, null, v1);
        protocolService.update(id, update, userId);

        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        protocol.setHeadOfLaboratoryName("Иванов И.И.");
        protocolRepository.saveAndFlush(protocol);

        // Module fix item 5/8: READY (and signing straight from it) is retired - drive the real
        // readyForApproval -> approve flow instead, so approve() actually certifies the (fallback,
        // in this LibreOffice-less test environment) PDF via approvedPdfHash/approvedContentVersion,
        // exactly as sign() now requires.
        Long v2 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.readyForApproval(id, v2, userId);
        Long v3 = protocolRepository.findById(id).orElseThrow().getVersion();
        try {
            protocolService.approve(id, v3, userId);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
        return id;
    }

    @Test
    void sign_refusesToSignAFallbackRenderedPdf() throws Exception {
        Long id = createSignableProtocol();
        // This test environment has no LibreOffice - buildPdf() always falls back, so the very
        // first PDF materialized for this protocol is guaranteed to be the fallback renderer's
        // output (see ProtocolDocumentGenerationService#buildPdf).
        byte[] pdfBytes = protocolService.downloadPdf(id, userId).inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        Long version = protocolRepository.findById(id).orElseThrow().getVersion();
        ProtocolApiDtos.SignProtocolRequest request = new ProtocolApiDtos.SignProtocolRequest(cms, version);

        ConflictException ex = assertThrows(ConflictException.class,
                () -> protocolService.sign(id, request, userId));
        assertEquals("PDF_FALLBACK_NOT_SIGNABLE", ex.getCode());
    }

    @Test
    void protocol_pdfIsFallback_flagReflectsTheRendererActuallyUsed() throws Exception {
        Long id = createSignableProtocol();
        documentService.generatePdf(id, userId);
        assertTrue(protocolRepository.findById(id).orElseThrow().isPdfIsFallback());
    }
}
