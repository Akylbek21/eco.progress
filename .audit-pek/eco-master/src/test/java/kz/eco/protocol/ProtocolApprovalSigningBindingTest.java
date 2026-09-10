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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P1 module fix item 8: APPROVE/SIGN are bound to one specific, verified PDF snapshot -
 * approvedPdfHash/approvedContentVersion are frozen at approve() time and re-validated bit-for-bit
 * at sign() time, never trusting whatever PDF happens to be currently attached.
 */
@SpringBootTest
@Transactional
class ProtocolApprovalSigningBindingTest {

    @Autowired private ProtocolService protocolService;
    @Autowired private ProtocolDocumentGenerationService documentService;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolResultRepository resultRepository;
    @Autowired private ProtocolTemplateRepository templateRepository;
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
    private String templateApiId = "ambient_air_szz";

    @BeforeEach
    void setUp() {
        if (templateRepository.findByCode("AMBIENT_AIR_SZZ").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("AMBIENT_AIR_SZZ");
            template.setName("Атмосферный воздух СЗЗ");
            template.setActive(true);
            templateRepository.save(template);
        }

        User user = new User();
        user.setEmail("approve-sign-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Approve Sign Tester");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        user.setIin("990101300123");
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Approve Sign Test");
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setLegalAddress("Адрес");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Точка №1");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory laboratory = laboratoryRepository.findFirstByIsDefaultTrueAndActiveTrue()
                .orElseGet(() -> {
                    Laboratory lab = new Laboratory();
                    lab.setName("Approve Sign Lab");
                    lab.setAddress("Адрес");
                    lab.setAccreditationNumber("KZ.AS." + System.nanoTime());
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

    private Long createReadyForApprovalProtocol() throws Exception {
        ProtocolApiDtos.ProtocolResponse p = protocolService.create(
                ProtocolCreateRequestFactory.minimal(templateApiId, companyId, objectId, laboratoryId, executorId), userId);
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
        Long v2 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.readyForApproval(id, v2, userId);
        return id;
    }

    // ---- 1. APPROVE актуального PDF -> success --------------------------------------------

    @Test
    void approve_ofCurrentPdf_succeedsAndFreezesApprovalBinding() throws Exception {
        long id = createReadyForApprovalProtocol();
        long version = protocolRepository.findById(id).orElseThrow().getVersion();

        ProtocolApiDtos.ProtocolResponse approved = protocolService.approve(id, version, userId);
        assertEquals("APPROVED", approved.status());

        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        assertNotNull(protocol.getApprovedPdfHash());
        assertEquals(protocol.getPdfSha256(), protocol.getApprovedPdfHash());
        assertEquals(protocol.getContentVersion(), protocol.getApprovedContentVersion());
        assertEquals(protocol.getContentVersion(), protocol.getPdfSourceContentVersion());
    }

    // ---- 2. content изменён после generation -> APPROVE fail (direct guard test) ----------

    @Test
    void requireApprovablePdf_rejectsWhenPdfMissing() throws Exception {
        long id = createReadyForApprovalProtocol();
        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        assertNull(protocol.getPdfFileId(), "precondition: no PDF generated yet");
        ConflictException ex = assertThrows(ConflictException.class, () -> protocolService.requireApprovablePdf(protocol));
        assertEquals("PROTOCOL_PDF_MISSING", ex.getCode());
    }

    @Test
    void requireApprovablePdf_rejectsWhenPdfSourceContentVersionIsStale() throws Exception {
        long id = createReadyForApprovalProtocol();
        documentService.generatePdf(id, userId);
        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        // Simulate "content changed after this PDF was generated" without going through
        // clearGeneratedDocuments (which would null pdfFileId itself) - a direct-DB mismatch
        // proves the guard, not just the normal app flow that already prevents this by construction.
        protocol.setContentVersion(protocol.getContentVersion() + 1);
        protocolRepository.saveAndFlush(protocol);

        ConflictException ex = assertThrows(ConflictException.class, () -> protocolService.requireApprovablePdf(protocol));
        assertEquals("PROTOCOL_PDF_STALE", ex.getCode());
    }

    @Test
    void requireApprovablePdf_rejectsWhenStoredHashDoesNotMatchStatedHash() throws Exception {
        long id = createReadyForApprovalProtocol();
        documentService.generatePdf(id, userId);
        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        protocol.setPdfSha256("0000000000000000000000000000000000000000000000000000000000000000");
        protocolRepository.saveAndFlush(protocol);

        ConflictException ex = assertThrows(ConflictException.class, () -> protocolService.requireApprovablePdf(protocol));
        assertEquals("PROTOCOL_PDF_HASH_MISMATCH", ex.getCode());
    }

    // ---- 3/4/5. PDF/version/hash changed after APPROVE -> SIGN fail (direct guard test) ----

    @Test
    void requireSignablePdf_rejectsWhenPdfRegeneratedAfterApprove() throws Exception {
        long id = createReadyForApprovalProtocol();
        long version = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.approve(id, version, userId);

        // Simulate the PDF having been regenerated after approve() (bypassing the normal
        // user-facing block, to prove requireSignablePdf itself catches this even if something
        // else ever regenerates internally) - pdfSourceContentVersion moves, contentVersion doesn't.
        documentService.generatePdf(id, userId);
        Protocol protocol = protocolRepository.findById(id).orElseThrow();

        ConflictException ex = assertThrows(ConflictException.class, () -> protocolService.requireSignablePdf(protocol));
        assertEquals("PROTOCOL_APPROVAL_STALE", ex.getCode(),
                "regenerating bumps contentVersion, so the NEW pdf's pdfSourceContentVersion == contentVersion "
                        + "holds - but approvedContentVersion (still the OLD contentVersion, frozen at approve() "
                        + "time) no longer matches, which is exactly the invariant this guard exists to catch");
    }

    @Test
    void requireSignablePdf_rejectsWhenApprovedContentVersionDiffersFromCurrent() throws Exception {
        long id = createReadyForApprovalProtocol();
        long version = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.approve(id, version, userId);

        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        // Directly desynchronize approvedContentVersion from contentVersion, independent of the
        // PDF/hash fields - isolates this specific invariant.
        protocol.setApprovedContentVersion(protocol.getApprovedContentVersion() - 1);
        protocolRepository.saveAndFlush(protocol);

        ConflictException ex = assertThrows(ConflictException.class, () -> protocolService.requireSignablePdf(protocol));
        assertEquals("PROTOCOL_APPROVAL_STALE", ex.getCode());
    }

    @Test
    void requireSignablePdf_rejectsWhenApprovedPdfHashDiffersFromCurrentPdfHash() throws Exception {
        long id = createReadyForApprovalProtocol();
        long version = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.approve(id, version, userId);

        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        protocol.setApprovedPdfHash("1111111111111111111111111111111111111111111111111111111111111111");
        protocolRepository.saveAndFlush(protocol);

        ConflictException ex = assertThrows(ConflictException.class, () -> protocolService.requireSignablePdf(protocol));
        assertEquals("PROTOCOL_PDF_HASH_MISMATCH", ex.getCode());
    }

    // ---- 6. APPROVED regeneration пользователем -> запрещена -------------------------------

    @Test
    void userFacingGenerateDocxAndPdf_areForbiddenOnceApproved() throws Exception {
        long id = createReadyForApprovalProtocol();
        long version = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.approve(id, version, userId);
        long approvedVersion = protocolRepository.findById(id).orElseThrow().getVersion();

        ConflictException docxEx = assertThrows(ConflictException.class,
                () -> protocolService.generateDocx(id, approvedVersion, userId));
        assertEquals("PROTOCOL_APPROVED_REGENERATION_FORBIDDEN", docxEx.getCode());

        ConflictException pdfEx = assertThrows(ConflictException.class,
                () -> protocolService.generatePdf(id, approvedVersion, userId));
        assertEquals("PROTOCOL_APPROVED_REGENERATION_FORBIDDEN", pdfEx.getCode());
    }

    // ---- 7. returnToDraft -> изменение -> новый PDF -> повторный approve -> SIGN success ----

    @Test
    void returnToDraft_thenEdit_thenReapprove_thenSign_succeeds() throws Exception {
        long id = createReadyForApprovalProtocol();
        long v1 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.approve(id, v1, userId);

        long approvedVersion = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.returnToDraft(id, approvedVersion, "Нужно исправить единицы измерения", userId);
        assertEquals("DRAFT", protocolRepository.findById(id).orElseThrow().getStatus().name());

        // Real content edit while back in DRAFT - modifying the existing (already fully-populated,
        // type-policy-valid) result row rather than adding a new minimal one, so this test isolates
        // the returnToDraft -> edit -> reapprove -> sign flow instead of also re-verifying every
        // template's own field-completeness policy for a brand-new row.
        long draftVersion = protocolRepository.findById(id).orElseThrow().getVersion();
        // Header-level edit (not touching ProtocolResult/raw-measurement state at all) - just
        // needs a genuine contentVersion bump for this round trip, isolated from any result-row
        // completeness/calculation policy.
        ProtocolApiDtos.UpdateProtocolRequest headerEdit = new ProtocolApiDtos.UpdateProtocolRequest(
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, "Уточнено после возврата в черновик", null, null, null, null, null, null,
                null, null, null, null, null, null, draftVersion);
        protocolService.update(id, headerEdit, userId);

        long reReadyVersion = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.readyForApproval(id, reReadyVersion, userId);
        long reApproveVersion = protocolRepository.findById(id).orElseThrow().getVersion();
        ProtocolApiDtos.ProtocolResponse reApproved = protocolService.approve(id, reApproveVersion, userId);
        assertEquals("APPROVED", reApproved.status());

        Protocol protocol = protocolRepository.findById(id).orElseThrow();
        byte[] pdfBytes = protocolService.downloadPdf(id, userId).inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        ProtocolApiDtos.SignProtocolRequest signRequest =
                new ProtocolApiDtos.SignProtocolRequest(cms, protocol.getVersion());

        ProtocolApiDtos.ProtocolResponse signed = protocolService.sign(id, signRequest, userId);
        assertEquals("SIGNED", signed.status());
    }
}
