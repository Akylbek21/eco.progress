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

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the "Протоколы" hardening pass: LABORATORY completing READY -> SIGNED unattended is
 * covered separately in ProtocolSigningApiTest; this class covers the rest - stale DOCX/PDF
 * invalidation on every mutation, server-side normative gating before sign, optimistic locking on
 * sign() itself, and each CMS signature being individually recoverable (fileId + protocol version).
 */
@SpringBootTest
@Transactional
class ProtocolSigningHardeningTest {

    @Autowired private ProtocolService protocolService;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolResultRepository resultRepository;
    @Autowired private ProtocolSignatureRepository signatureRepository;
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
        user.setEmail("sign-hardening-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Sign Hardening Tester");
        // Module fix item 5: signing now always requires the formal APPROVED review path,
        // supervisor-only (the READY-based LABORATORY self-sign shortcut is retired) - this
        // fixture's single actor drives create/approve/sign throughout, so it must be a
        // supervisor role for sign() to ever succeed.
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        user.setIin("990101300123");
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Sign Hardening");
        company.setBin("111222333444");
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

    private ProtocolApiDtos.ProtocolResponse createDraft() {
        return protocolService.create(new ProtocolApiDtos.CreateProtocolRequest(
                templateCode, companyId, objectId, null,
                LocalDate.now().toString(), LocalDate.now().toString(), LocalDate.now().toString(),
                LocalDate.now().toString(), LocalDate.now().toString(), LocalDate.now().toString(),
                "Контроль", "Контроль", "Контроль", "20°C", "20°C", "Продукция", "Договор",
                null, null, null, null, null, null, null, null, null, null, null,
                laboratoryId, executorId, null, null, null), userId);
    }

    /** Walks a fresh draft to a directly-signable READY protocol - module spec item 1's shortcut
     *  (READY -&gt; SIGNED with no approve() step). testingMethodDocument/headOfLaboratoryName are
     *  required by validateBeforeSign's validateReadyForApproval/validateBeforeApprove chain. */
    private Long createDraftProtocolWithResult() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
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
        return id;
    }

    /** Module fix item 5/8: READY (and signing straight from it) is retired - drives the real
     *  readyForApproval -> approve flow so approve() certifies the PDF via
     *  approvedPdfHash/approvedContentVersion, exactly as sign() now requires. */
    private Long createSignableProtocol() {
        Long id = createDraftProtocolWithResult();
        Long v2 = protocolRepository.findById(id).orElseThrow().getVersion();
        protocolService.readyForApproval(id, v2, userId);
        Long v3 = protocolRepository.findById(id).orElseThrow().getVersion();
        try {
            protocolService.approve(id, v3, userId);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        return id;
    }

    /** Signs over whatever PDF createSignableProtocol()'s approve() call already certified - module
     *  fix item 8: sign() no longer auto-regenerates, so building the CMS over anything other than
     *  the ALREADY-approved bytes would fail the new approvedPdfHash/pdfSha256 binding check
     *  instead of succeeding. version == null means "use whatever the protocol's version is right
     *  now"; a caller deliberately testing staleness passes an explicit (already-stale) value. */
    private ProtocolApiDtos.SignProtocolRequest signRequest(Long protocolId, Long version) throws Exception {
        byte[] pdfBytes = protocolService.downloadPdf(protocolId, userId).inputStream().readAllBytes();
        String cms = TestCmsSigner.signAttached(pdfBytes);
        Long effectiveVersion = version != null ? version : protocolRepository.findById(protocolId).orElseThrow().getVersion();
        return new ProtocolApiDtos.SignProtocolRequest(cms, effectiveVersion);
    }

    // ---- workflow: APPROVED -> SIGNED, optimistic locking -------------------------------------

    @Test
    void sign_staleVersion_returns409OptimisticLockConflict() throws Exception {
        Long id = createSignableProtocol();
        Long currentVersion = protocolRepository.findById(id).orElseThrow().getVersion();
        ProtocolApiDtos.SignProtocolRequest request = signRequest(id, currentVersion - 1);

        ConflictException ex = assertThrows(ConflictException.class,
                () -> protocolService.sign(id, request, userId));
        assertEquals("OPTIMISTIC_LOCK_CONFLICT", ex.getCode());
    }

    // ---- stale DOCX/PDF invalidation -----------------------------------------------------------

    @Test
    void addResult_clearsStaleGeneratedDocuments() throws Exception {
        Long id = createDraftProtocolWithResult();
        documentService.generatePdf(id, userId); // materializes pdfFileId
        Protocol before = protocolRepository.findById(id).orElseThrow();
        assertNotNull(before.getPdfFileId(), "precondition: a PDF must already be generated");

        protocolService.addResult(id, new ProtocolApiDtos.ResultRow(
                null, null, null,
                Map.of("indicator", "Диоксид азота", "unit", "мг/м³", "result", 0.2)
        ), before.getVersion(), userId);

        Protocol after = protocolRepository.findById(id).orElseThrow();
        assertNull(after.getPdfFileId(), "adding a result must invalidate the previously generated PDF");
        assertNull(after.getDocxFileId(), "adding a result must invalidate the previously generated DOCX");
    }

    @Test
    void deleteResult_clearsStaleGeneratedDocuments() throws Exception {
        Long id = createDraftProtocolWithResult();
        Long v0 = protocolRepository.findById(id).orElseThrow().getVersion();
        Map<String, Object> row = protocolService.addResult(id, new ProtocolApiDtos.ResultRow(
                null, null, null, Map.of("indicator", "Второй показатель", "unit", "мг/м³", "result", 0.1)
        ), v0, userId);
        Long resultId = Long.parseLong(String.valueOf(row.get("id")));
        documentService.generatePdf(id, userId);
        Protocol beforeDelete = protocolRepository.findById(id).orElseThrow();
        assertNotNull(beforeDelete.getPdfFileId());

        protocolService.deleteResult(id, resultId, beforeDelete.getVersion(), userId);

        assertNull(protocolRepository.findById(id).orElseThrow().getPdfFileId(),
                "deleting a result must invalidate the previously generated PDF");
    }

    // ---- server-side normative gate before sign ------------------------------------------------

    /** Module spec (creation pass): the normative-active/device-verified gate now runs as part of
     *  validateReadyForApproval (item 5 - checked before ANY DRAFT-exit transition, aggregated
     *  with the rest of that method's fieldErrors), which validateBeforeSign also calls via
     *  validateBeforeApprove - so this now surfaces as a ValidationException with a fieldErrors
     *  entry, not a standalone fail-fast ConflictException. */
    @Test
    void sign_blocksWhenAResultsNormativeWasNeverSelected() throws Exception {
        Long id = createSignableProtocol();
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(id);
        ProtocolResult result = results.get(0);
        result.setInternalStatus(ResultInternalStatus.NORMATIVE_NOT_SELECTED);
        resultRepository.saveAndFlush(result);

        ProtocolApiDtos.SignProtocolRequest request = signRequest(id, null);
        kz.eco.common.exception.ValidationException ex = assertThrows(kz.eco.common.exception.ValidationException.class,
                () -> protocolService.sign(id, request, userId));
        assertTrue(ex.getDetails().stream().anyMatch(d -> "NORMATIVE_NOT_SELECTED".equals(d.code())),
                "must include a NORMATIVE_NOT_SELECTED field error");
    }

    @Test
    void sign_blocksWhenAResultsNormativeIsInactive() throws Exception {
        Long id = createSignableProtocol();
        List<ProtocolResult> results = resultRepository.findByProtocolIdOrderByRowNumberAsc(id);
        ProtocolResult result = results.get(0);
        result.setInternalStatus(ResultInternalStatus.NORMATIVE_INACTIVE);
        resultRepository.saveAndFlush(result);

        ProtocolApiDtos.SignProtocolRequest request = signRequest(id, null);
        kz.eco.common.exception.ValidationException ex = assertThrows(kz.eco.common.exception.ValidationException.class,
                () -> protocolService.sign(id, request, userId));
        assertTrue(ex.getDetails().stream().anyMatch(d -> "NORMATIVE_INACTIVE".equals(d.code())),
                "must include a NORMATIVE_INACTIVE field error");
    }

    // ---- each signature individually recoverable (fileId + protocol version) ------------------

    @Test
    void sign_persistsSignatureWithFileIdAndCurrentProtocolVersion() throws Exception {
        Long id = createSignableProtocol();
        ProtocolApiDtos.SignProtocolRequest request = signRequest(id, null);

        protocolService.sign(id, request, userId);

        List<ProtocolSignature> signatures = signatureRepository.findAllByProtocolIdIn(List.of(id));
        assertEquals(1, signatures.size(), "exactly one signature must have been persisted");
        ProtocolSignature signature = signatures.get(0);
        assertNotNull(signature.getFileId(), "every CMS signature must be individually recoverable by its own fileId");
        assertNotNull(signature.getProtocolVersion(),
                "the signature must record the protocol version it was signed against");
    }

}
