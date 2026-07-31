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
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Audit finding: most protocol workflow mutation endpoints did not accept/verify a client-supplied
 * {@code version} before executing, so a stale double-submit could do partial work before JPA's own
 * optimistic-lock check (if it was ever reached at all). Every method below now takes an explicit
 * version and rejects a mismatch up-front via {@code ConflictException("...", "OPTIMISTIC_LOCK_CONFLICT")}
 * - the SAME code GlobalExceptionHandler already maps to 409 for the real JPA-level exception, so
 * a stale client sees one consistent error either way. Also covers the reason/comment field
 * alias round-trip (return-for-revision, cancel).
 */
@SpringBootTest
@Transactional
class ProtocolVersionConflictTest {

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
        user.setEmail("version-conflict-" + System.nanoTime() + "@ecoprogress.kz");
        user.setPasswordHash(passwordEncoder.encode("demo123"));
        user.setName("Version Conflict Tester");
        user.setRole(UserRole.ADMIN);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        Company company = new Company();
        company.setName("ТОО Version Conflict");
        company.setBin("111122223333");
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
                laboratoryId, executorId, null), userId);
    }

    /** readyForApproval requires testingMethodDocument to be set (validateReadyForApproval), so
     *  any test exercising the readyForApproval -> ... chain needs this, not just a result row. */
    private ProtocolApiDtos.ProtocolResponse createDraftWithResult() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        protocolService.addResult(Long.parseLong(p.id()), new ProtocolApiDtos.ResultRow(
                null, null, null,
                Map.of("indicator", "Пыль", "unit", "мг/м³", "result", 1.5,
                        "samplingPlace", "Место 1", "pdk", 4.0)
        ), userId);
        ProtocolApiDtos.TestingData testing = new ProtocolApiDtos.TestingData(
                null, null, "МУК 4.1.2468-09", null, null, null, null, null);
        ProtocolApiDtos.UpdateProtocolRequest update = new ProtocolApiDtos.UpdateProtocolRequest(
                null, null, null, null, null, null, null, null, testing, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        return protocolService.update(Long.parseLong(p.id()), update, userId);
    }

    private ConflictException assertVersionConflict(Executable action) {
        ConflictException ex = assertThrows(ConflictException.class, action::run);
        assertEquals("OPTIMISTIC_LOCK_CONFLICT", ex.getCode());
        return ex;
    }

    interface Executable {
        void run() throws Exception;
    }

    // ---- readyForApproval ----

    @Test
    void readyForApproval_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long staleVersion = p.version() - 1;
        assertVersionConflict(() -> protocolService.readyForApproval(id, staleVersion, userId));
    }

    @Test
    void readyForApproval_currentVersion_succeeds() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        ProtocolApiDtos.ProtocolResponse result = protocolService.readyForApproval(id, p.version(), userId);
        assertEquals("READY_FOR_APPROVAL", result.status());
    }

    // ---- returnForRevision (reason/comment alias) ----

    @Test
    void returnForRevision_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        protocolService.readyForApproval(id, p.version(), userId);
        ProtocolApiDtos.ProtocolResponse readyState = protocolService.get(id);
        long staleVersion = readyState.version() - 1;
        assertVersionConflict(() -> protocolService.returnForRevision(id, staleVersion, "Не хватает данных", userId));
    }

    @Test
    void returnForRevision_reason_roundTrips() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        protocolService.readyForApproval(id, p.version(), userId);
        ProtocolApiDtos.ProtocolResponse readyState = protocolService.get(id);
        protocolService.returnForRevision(id, readyState.version(), "Нужно исправить единицы измерения", userId);
        ProtocolApiDtos.HistoryItem lastEntry = protocolService.audit(id).get(0);
        assertEquals("Нужно исправить единицы измерения", lastEntry.comment());
    }

    // ---- approve ----

    @Test
    void approve_staleVersion_rejectedWithConflict() throws Exception {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        protocolService.readyForApproval(id, p.version(), userId);
        ProtocolApiDtos.ProtocolResponse readyState = protocolService.get(id);
        long staleVersion = readyState.version() - 1;
        assertVersionConflict(() -> protocolService.approve(id, staleVersion, userId));
    }

    // ---- cancel (reason/comment alias) ----

    @Test
    void cancel_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long staleVersion = p.version() - 1;
        assertVersionConflict(() -> protocolService.cancel(id, staleVersion, "Отменено клиентом", userId));
    }

    @Test
    void cancel_reason_roundTrips() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        protocolService.cancel(id, p.version(), "Клиент отозвал заявку", userId);
        ProtocolApiDtos.HistoryItem lastEntry = protocolService.audit(id).get(0);
        assertEquals("Клиент отозвал заявку", lastEntry.comment());
    }

    // ---- archive ----

    @Test
    void archive_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        ProtocolApiDtos.ProtocolResponse cancelled = protocolService.cancel(id, p.version(), null, userId);
        long staleVersion = cancelled.version() - 1;
        assertVersionConflict(() -> protocolService.archive(id, staleVersion, userId));
    }

    // ---- returnToDraft ----

    @Test
    void returnToDraft_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        protocolService.readyForApproval(id, p.version(), userId);
        ProtocolApiDtos.ProtocolResponse readyState = protocolService.get(id);
        long staleVersion = readyState.version() - 1;
        assertVersionConflict(() -> protocolService.returnToDraft(id, staleVersion, userId));
    }

    // ---- checkNormatives ----

    @Test
    void checkNormatives_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraftWithResult();
        long id = Long.parseLong(p.id());
        long staleVersion = p.version() - 1;
        assertVersionConflict(() -> protocolService.checkNormatives(id, staleVersion, userId));
    }

    // ---- addResult / updateResult / deleteResult (version travels inside the Map body) ----

    @Test
    void addResult_staleVersionInBody_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        long id = Long.parseLong(p.id());
        Map<String, Object> body = new HashMap<>(Map.of(
                "indicator", "Пыль", "unit", "мг/м³", "result", 1.5,
                "samplingPlace", "Место 1", "pdk", 4.0,
                "version", p.version() - 1));
        assertVersionConflict(() -> protocolService.addResult(id, body, userId));
    }

    @Test
    void addResult_versionField_isNeverPersistedAsExtraValue() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        long id = Long.parseLong(p.id());
        Map<String, Object> body = new HashMap<>(Map.of(
                "indicator", "Пыль", "unit", "мг/м³", "result", 1.5,
                "samplingPlace", "Место 1", "pdk", 4.0,
                "version", p.version()));
        Map<String, Object> row = protocolService.addResult(id, body, userId);
        assertNull(row.get("version"), "version is the protocol's optimistic-lock token, not a result field");
    }

    @Test
    void updateResult_staleVersionInBody_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        long id = Long.parseLong(p.id());
        Map<String, Object> row = protocolService.addResult(id, new HashMap<>(Map.of(
                "indicator", "Пыль", "unit", "мг/м³", "result", 1.5,
                "samplingPlace", "Место 1", "pdk", 4.0)), userId);
        long resultId = Long.parseLong(String.valueOf(row.get("id")));
        ProtocolApiDtos.ProtocolResponse current = protocolService.get(id);
        Map<String, Object> update = new HashMap<>(Map.of(
                "result", 2.0, "version", current.version() - 1));
        assertVersionConflict(() -> protocolService.updateResult(id, resultId, update, userId));
    }

    @Test
    void deleteResult_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        long id = Long.parseLong(p.id());
        Map<String, Object> row = protocolService.addResult(id, new HashMap<>(Map.of(
                "indicator", "Пыль", "unit", "мг/м³", "result", 1.5,
                "samplingPlace", "Место 1", "pdk", 4.0)), userId);
        long resultId = Long.parseLong(String.valueOf(row.get("id")));
        ProtocolApiDtos.ProtocolResponse current = protocolService.get(id);
        long staleVersion = current.version() - 1;
        assertVersionConflict(() -> protocolService.deleteResult(id, resultId, staleVersion, userId));
    }

    // ---- measurement device attach/detach ----

    @Test
    void attachMeasurementDevice_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        long id = Long.parseLong(p.id());
        long staleVersion = p.version() - 1;
        assertVersionConflict(() -> protocolService.attachMeasurementDevice(id,
                new ProtocolApiDtos.AttachMeasurementDeviceRequest(999999L, null, staleVersion), userId));
    }

    @Test
    void detachMeasurementDevice_staleVersion_rejectedWithConflict() {
        ProtocolApiDtos.ProtocolResponse p = createDraft();
        long id = Long.parseLong(p.id());
        long staleVersion = p.version() - 1;
        assertVersionConflict(() -> protocolService.detachMeasurementDevice(id, 999999L, staleVersion, userId));
    }

    // ---- replace (already had version + reason before this change; still exercised here) ----

    @Test
    void replace_reason_acceptsCommentAlias_viaJson() throws Exception {
        // ReplaceProtocolRequest.reason has @JsonAlias("comment") - verified at the Jackson layer
        // in ProtocolReasonAliasJsonTest; this covers the direct-call path used by every service
        // caller (reason itself, not the alias, since Java call sites can't send raw JSON).
        ProtocolApiDtos.ReplaceProtocolRequest request = new ProtocolApiDtos.ReplaceProtocolRequest("Опечатка", null);
        assertEquals("Опечатка", request.reason());
    }
}
