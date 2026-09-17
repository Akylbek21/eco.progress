package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.dto.PekProgramSectionDtos.DischargeSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceDto;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementRequest;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards on the subject-domain registries the frontend now edits: what may be changed and when,
 * whose data it is, and what a change invalidates downstream.
 *
 * <p>Complements {@code PekInventoryApiTest} (routing, If-Match plumbing, tenant isolation over
 * HTTP) and {@code PekSubjectDomainAndOfficialFormTest} (field round-trips and rendering).
 */
@SpringBootTest
@Transactional
class PekInventoryGuardsTest {

    @Autowired private PekInventoryService inventory;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;

    private Long programId;
    private Long reportId;
    private Long companyId;
    private Long objectId;
    private User head;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("ТОО Реестры " + System.nanoTime());
        company.setBin(String.valueOf(200000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.saveAndFlush(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Объект реестров");
        object.setStatus("ACTIVE");
        companyObjectRepository.saveAndFlush(object);
        objectId = object.getId();

        head = new User();
        head.setEmail("pek-inv-guards-" + System.nanoTime() + "@test.kz");
        head.setPasswordHash("test");
        head.setName("Инженер");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.saveAndFlush(head);

        programId = program(PekProgramStatus.DRAFT);
        reportId = report(programId, PekReportStatus.DRAFT, 1);
    }

    private Long program(PekProgramStatus status) {
        PekProgram p = new PekProgram();
        p.setCompanyId(companyId);
        p.setObjectId(objectId);
        p.setNumber("ПЭК-INV-" + System.nanoTime());
        p.setName("Программа реестров");
        p.setStatus(status);
        p.setValidFrom(LocalDate.of(2026, 1, 1));
        p.setValidUntil(LocalDate.of(2026, 12, 31));
        p.setResponsibleUserId(head.getId());
        p.setCreatedBy(head.getId());
        return programRepository.saveAndFlush(p).getId();
    }

    private Long report(Long program, PekReportStatus status, int quarter) {
        PekReport r = new PekReport();
        r.setCompanyId(companyId);
        r.setObjectId(objectId);
        r.setProgramId(program);
        r.setPeriodType(PekPeriodType.QUARTER);
        r.setReportYear(2026);
        r.setReportQuarter(quarter);
        r.setPeriodStart(LocalDate.of(2026, 1, 1));
        r.setPeriodEnd(LocalDate.of(2026, 3, 31));
        r.setStatus(status);
        r.setResponsibleUserId(head.getId());
        r.setCreatedBy(head.getId());
        r.computePeriodKey();
        return reportRepository.saveAndFlush(r).getId();
    }

    private EmissionSourceRequest emission(String code) {
        return new EmissionSourceRequest(code, "Труба", "ORGANIZED", null,
                "30", "1", null, null, "80", 8000, null, 0);
    }

    private WasteItemDto wasteItem() {
        return inventory.createWasteItem(programId, new WasteItemRequest(
                "Отход", "001", "IV", "10", "т", 90, "Площадка", null, null, 0));
    }

    // ---- closed programs and reports are closed --------------------------------------------------

    @Test
    void registriesOfANonEditableProgram_cannotBeChanged() {
        EmissionSourceDto existing = inventory.createEmissionSource(programId, emission("0001"));
        WasteItemDto waste = wasteItem();

        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setStatus(PekProgramStatus.ACTIVE);
        programRepository.saveAndFlush(program);

        for (Executable call : new Executable[]{
                () -> inventory.createEmissionSource(programId, emission("0002")),
                () -> inventory.updateEmissionSource(programId, existing.id(), emission("0001"), existing.version()),
                () -> inventory.deleteEmissionSource(programId, existing.id(), existing.version()),
                () -> inventory.createDischargeSource(programId,
                        new DischargeSourceRequest("В-1", "Выпуск", null, null, null, null, null, null, null, 0)),
                () -> inventory.createWasteItem(programId, new WasteItemRequest(
                        "Другой отход", null, null, null, null, null, null, null, null, 0)),
                () -> inventory.deleteWasteItem(programId, waste.id(), waste.version())}) {
            ConflictException e = assertThrows(ConflictException.class, call::run);
            assertEquals("PEK_PROGRAM_NOT_EDITABLE", e.getCode());
        }

        // Reading stays available - an ACTIVE program's registries are still part of the record.
        assertEquals(1, inventory.listEmissionSources(programId).size());
    }

    @Test
    void wasteMovementsOfANonEditableReport_cannotBeChanged() {
        WasteItemDto item = wasteItem();
        WasteMovementDto movement = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "2", "1", null, "2", null, null, null), null);

        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.SIGNED);
        reportRepository.saveAndFlush(report);

        ConflictException upsert = assertThrows(ConflictException.class, () -> inventory.upsertWasteMovement(
                reportId, new WasteMovementRequest(item.id(), "5", null, null, null, "5", null, null, null),
                movement.version()));
        assertEquals("PEK_REPORT_NOT_EDITABLE", upsert.getCode());

        ConflictException delete = assertThrows(ConflictException.class,
                () -> inventory.deleteWasteMovement(reportId, movement.id(), movement.version()));
        assertEquals("PEK_REPORT_NOT_EDITABLE", delete.getCode());

        assertEquals(1, inventory.listWasteMovements(reportId).size());
    }

    // ---- ownership -------------------------------------------------------------------------------

    @Test
    void wasteItemFromAnotherProgram_cannotBeUsedForThisReportsMovement() {
        Long otherProgram = program(PekProgramStatus.DRAFT);
        WasteItemDto foreign = inventory.createWasteItem(otherProgram, new WasteItemRequest(
                "Чужой отход", null, null, null, null, null, null, null, null, 0));

        // The report belongs to programId, not otherProgram - its movements must be confined to
        // that program's catalogue, otherwise one report could report figures against a waste type
        // its own programme never declared.
        assertThrows(NotFoundException.class, () -> inventory.upsertWasteMovement(reportId,
                new WasteMovementRequest(foreign.id(), "1", null, null, null, "1", null, null, null), null));
    }

    @Test
    void aMovementCannotBeAddressedThroughADifferentReport() {
        WasteItemDto item = wasteItem();
        WasteMovementDto movement = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", null, null, null, "1", null, null, null), null);
        Long otherReport = report(programId, PekReportStatus.DRAFT, 2);

        assertThrows(NotFoundException.class,
                () -> inventory.deleteWasteMovement(otherReport, movement.id(), movement.version()));
    }

    // ---- optimistic locking on the child record ---------------------------------------------------

    @Test
    void versionZeroIsARealVersion_notTreatedAsAbsent() {
        EmissionSourceDto created = inventory.createEmissionSource(programId, emission("0001"));
        assertEquals(0L, created.version(), "новая запись должна иметь версию 0");

        EmissionSourceDto updated = inventory.updateEmissionSource(
                programId, created.id(), emission("0001-изм"), 0L);
        assertEquals("0001-изм", updated.code());
        assertNotEquals(0L, updated.version());
    }

    @Test
    void missingOrStaleChildVersionIsRejected() {
        EmissionSourceDto created = inventory.createEmissionSource(programId, emission("0001"));

        BadRequestException missing = assertThrows(BadRequestException.class,
                () -> inventory.updateEmissionSource(programId, created.id(), emission("x"), null));
        assertEquals("VERSION_REQUIRED", missing.getCode());

        ConflictException stale = assertThrows(ConflictException.class,
                () -> inventory.updateEmissionSource(programId, created.id(), emission("x"), 999L));
        assertEquals("PEK_VERSION_CONFLICT", stale.getCode());
    }

    /** Updating an existing movement needs its version; creating the first one for a waste type has
     *  nothing to check against and must not demand one. */
    @Test
    void wasteMovementUpsertRequiresAVersionOnlyOnceARowExists() {
        WasteItemDto item = wasteItem();
        WasteMovementDto created = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "1", null, null, "2", null, null, null), null);

        BadRequestException missing = assertThrows(BadRequestException.class,
                () -> inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                        item.id(), "2", null, null, null, "2", null, null, null), null));
        assertEquals("VERSION_REQUIRED", missing.getCode());

        ConflictException stale = assertThrows(ConflictException.class,
                () -> inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                        item.id(), "2", null, null, null, "2", null, null, null), created.version() + 5));
        assertEquals("PEK_VERSION_CONFLICT", stale.getCode());
    }

    @Test
    void repeatedUpsertKeepsExactlyOneRowPerWasteTypeAndPeriod() {
        WasteItemDto item = wasteItem();
        WasteMovementDto v1 = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "1", null, null, "2", null, null, null), null);
        WasteMovementDto v2 = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "3", null, null, "4", null, null, null), v1.version());
        WasteMovementDto v3 = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "5", null, null, "6", null, null, null), v2.version());

        assertEquals(v1.id(), v3.id());
        assertEquals(1, inventory.listWasteMovements(reportId).size());
        assertEquals("5", v3.generated());
    }

    // ---- balance is reported, never silently corrected ---------------------------------------------

    @Test
    void balanceMismatchIsSurfacedThroughReconcilesAndImpliedClosingBalance() {
        WasteItemDto item = wasteItem();
        WasteMovementDto ok = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "10", "5", "3", "2", "10", null, null, null), null);
        assertTrue(ok.reconciles());
        assertEquals("10", ok.impliedClosingBalance());
        assertEquals("10", ok.closingBalance());

        WasteMovementDto off = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "10", "5", "3", "2", "99", null, null, null), ok.version());
        assertEquals("99", off.closingBalance(), "введённое значение остаётся тем, что уйдёт в отчёт");
        assertEquals("10", off.impliedClosingBalance());
        assertTrue(!off.reconciles());
    }

    // ---- a registry change invalidates what was derived from it -------------------------------------

    @Test
    void editingAProgramRegistryBumpsContentRevisionOnTheProgramAndItsReports() {
        long programBefore = programRepository.findById(programId).orElseThrow().getContentRevision();
        long reportBefore = reportRepository.findById(reportId).orElseThrow().getContentRevision();

        EmissionSourceDto created = inventory.createEmissionSource(programId, emission("0001"));

        long programAfterCreate = programRepository.findById(programId).orElseThrow().getContentRevision();
        long reportAfterCreate = reportRepository.findById(reportId).orElseThrow().getContentRevision();
        assertTrue(programAfterCreate > programBefore, "создание записи реестра должно менять contentRevision программы");
        assertTrue(reportAfterCreate > reportBefore,
                "и каскадом отчётов, иначе уже сформированный комплект не станет устаревшим");

        inventory.updateEmissionSource(programId, created.id(), emission("0001-изм"), created.version());
        assertTrue(programRepository.findById(programId).orElseThrow().getContentRevision() > programAfterCreate);
        assertTrue(reportRepository.findById(reportId).orElseThrow().getContentRevision() > reportAfterCreate);
    }

    @Test
    void editingWasteMovementBumpsTheReportsContentRevision() {
        WasteItemDto item = wasteItem();
        long before = reportRepository.findById(reportId).orElseThrow().getContentRevision();

        WasteMovementDto movement = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "1", null, null, "2", null, null, null), null);
        long afterUpsert = reportRepository.findById(reportId).orElseThrow().getContentRevision();
        assertTrue(afterUpsert > before);

        inventory.deleteWasteMovement(reportId, movement.id(), movement.version());
        assertTrue(reportRepository.findById(reportId).orElseThrow().getContentRevision() > afterUpsert);
    }

    /** Minimal callable that lets the parameterised loop above throw checked-free. */
    @FunctionalInterface
    private interface Executable {
        void run();
    }
}
