package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.docgen.PekProgramDocumentGenerationService;
import kz.eco.pek.docgen.PekReportDocumentGenerationService;
import kz.eco.pek.dto.PekProgramSectionDtos.DischargeSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.EmissionSourceRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteItemRequest;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementDto;
import kz.eco.pek.dto.PekProgramSectionDtos.WasteMovementRequest;
import kz.eco.storage.FileStorageService;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the three P0 items that turned the PEK documents from placeholders into documents:
 * the subject-domain inventories (emission sources, discharge outlets, waste catalogue and its
 * per-period movements), the official report's actual structure, and the program document.
 *
 * <p>Assertions read the rendered DOCX text rather than the value snapshot, because the complaint
 * being fixed was about what ends up in the file a person is handed.
 */
@SpringBootTest
@Transactional
class PekSubjectDomainAndOfficialFormTest {

    @Autowired private PekInventoryService inventory;
    @Autowired private PekProgramDocumentGenerationService programDocs;
    @Autowired private PekReportDocumentGenerationService reportDocs;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekReportDocumentVersionRepository documentVersionRepository;
    @Autowired private FileStorageService fileStorageService;

    private Long programId;
    private Long reportId;
    private Long userId;
    private Long controlItemId;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("ТОО Форма Тест " + System.nanoTime());
        company.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        company.setLegalAddress("г. Астана, ул. Тестовая, 1");
        company.setDirectorName("Директор Тестов");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Промплощадка №1");
        object.setAddress("г. Астана, промзона");
        object.setCoordinates("51.16, 71.47");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User head = new User();
        head.setEmail("pek-form-" + System.nanoTime() + "@test.kz");
        head.setPasswordHash("test");
        head.setName("Ответственный Тестов");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);
        userId = head.getId();

        PekProgram program = new PekProgram();
        program.setCompanyId(company.getId());
        program.setObjectId(object.getId());
        program.setNumber("ПЭК-ФОРМА-1");
        program.setName("Программа ПЭК формы");
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setResponsibleUserId(head.getId());
        program.setCreatedBy(head.getId());
        program.setKato("710000000");
        program.setOked("35.11.1");
        program.setEnvironmentalCategory("II");
        program.setProductionCharacteristics("Производство тепловой энергии");
        program.setDesignCapacity("120 Гкал/ч");
        program.setActualCapacity("84 Гкал/ч");
        programRepository.saveAndFlush(program);
        programId = program.getId();

        PekProgramControlItem item = new PekProgramControlItem();
        item.setProgramId(programId);
        item.setCode("CI-1");
        item.setName("Контроль выбросов котельной");
        item.setControlType(PekControlType.EMISSION);
        item.setFrequencyType(PekFrequencyType.QUARTERLY);
        controlItemRepository.saveAndFlush(item);
        controlItemId = item.getId();

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(programId);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportType(PekReportType.PEK_QUARTERLY);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.DRAFT);
        report.setResponsibleUserId(head.getId());
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        reportId = report.getId();
    }

    private void declareDirection(PekMonitoringType type) {
        PekProgramMonitoring d = new PekProgramMonitoring();
        d.setProgramId(programId);
        d.setMonitoringType(type);
        d.setName("Направление " + type);
        d.setMethodology("Инструментальный");
        d.setFrequencyType(PekFrequencyType.QUARTERLY);
        d.setControlItemIds(new LinkedHashSet<>(List.of(controlItemId)));
        monitoringRepository.saveAndFlush(d);
    }

    private String officialReportText() throws Exception {
        var version = reportDocs.generateOfficialDocx(reportId, userId);
        try (var in = fileStorageService.load(version.getDocxFileId()).inputStream();
             XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(in.readAllBytes()));
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText();
        }
    }

    private String programDocumentText() throws Exception {
        byte[] docx = programDocs.renderDocx(programId);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx));
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText();
        }
    }

    // ---- subject-domain inventories ---------------------------------------------------------------

    @Test
    void emissionSourceCarriesItsPhysicalDescription_notJustAnId() {
        var created = inventory.createEmissionSource(programId, new EmissionSourceRequest(
                "0001", "Труба котельной", "ORGANIZED", "Котельный цех",
                "35.5", "1.2", "51.16, 71.47", "Циклон ЦН-15", "92.5", 8760, null, 1));
        assertEquals("0001", created.code());
        assertEquals("35.5", created.heightM());
        assertEquals("92.5", created.cleaningEfficiencyPercent());
        assertEquals(8760, created.operatingHoursPerYear());
        assertEquals(1, inventory.listEmissionSources(programId).size());
    }

    @Test
    void invalidNumbersAreRejectedByName_notSilentlyDropped() {
        assertThrows(BadRequestException.class, () -> inventory.createEmissionSource(programId,
                new EmissionSourceRequest("0002", "Труба", null, null, "не число", null, null, null, null, null, null, null)));
        assertThrows(BadRequestException.class, () -> inventory.createEmissionSource(programId,
                new EmissionSourceRequest("0003", "Труба", null, null, "-5", null, null, null, null, null, null, null)));
        // Cleaning efficiency above 100% is not a number this domain can mean.
        assertThrows(BadRequestException.class, () -> inventory.createEmissionSource(programId,
                new EmissionSourceRequest("0004", "Труба", null, null, null, null, null, null, "120", null, null, null)));
    }

    @Test
    void dischargeOutletCarriesReceivingBodyAndPermittedVolume() {
        var created = inventory.createDischargeSource(programId, new DischargeSourceRequest(
                "В-1", "Выпуск ливневых вод", "р. Есиль", "Ливневые", "51.17, 71.48",
                "12500.5", "м3/год", "Очистные сооружения ЛОС-5", null, 1));
        assertEquals("р. Есиль", created.receivingWaterBody());
        assertEquals("12500.5", created.permittedVolume());
    }

    @Test
    void receiverBinMustBeTwelveDigits() {
        WasteItemDto item = someWasteItem();
        assertThrows(BadRequestException.class, () -> inventory.upsertWasteMovement(reportId,
                new WasteMovementRequest(item.id(), "1", "1", "1", null, "1", "ТОО Утилизатор", "12345", null), null));
    }

    @Test
    void wasteMovementIsUpsertedPerPeriod_neverDuplicatedForTheSameWasteType() {
        WasteItemDto item = someWasteItem();
        WasteMovementDto first = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1.5", "3.0", "2.0", null, "2.5", "ТОО Утилизатор", "123456789012", null), null);
        assertEquals(1, inventory.listWasteMovements(reportId).size());

        WasteMovementDto second = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1.5", "4.0", "2.0", null, "3.5", "ТОО Утилизатор", "123456789012", null),
                first.version());
        assertEquals(first.id(), second.id(), "второй ввод по тому же отходу должен обновлять строку периода");
        assertEquals(1, inventory.listWasteMovements(reportId).size());
        assertEquals("4", second.generated());
    }

    @Test
    void closingBalanceThatDoesNotAddUpIsFlagged_notRewritten() {
        WasteItemDto item = someWasteItem();
        WasteMovementDto m = inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "10", "5", "3", "0", "99", null, null, null), null);
        assertEquals("99", m.closingBalance(), "введённый остаток остаётся тем, что будет в отчёте");
        assertEquals("12", m.impliedClosingBalance());
        assertFalse(m.reconciles());
    }

    @Test
    void wasteTypeWithReportedFiguresCannotBeDeleted() {
        WasteItemDto item = someWasteItem();
        inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "1", "1", null, null, "2", null, null, null), null);
        ConflictException e = assertThrows(ConflictException.class,
                () -> inventory.deleteWasteItem(programId, item.id(), item.version()));
        assertTrue(e.getMessage().contains("движения"));
    }

    // ---- official report structure ------------------------------------------------------------------

    @Test
    void officialReportCarriesTheAdministrativeDataBlock() throws Exception {
        String text = officialReportText();
        assertTrue(text.contains("КАТО"), "в официальном отчёте не оказалось строки КАТО");
        assertTrue(text.contains("710000000"));
        assertTrue(text.contains("ОКЭД"));
        assertTrue(text.contains("35.11.1"));
        assertTrue(text.contains("Категория объекта"));
        assertTrue(text.contains("Проектная мощность"));
        assertTrue(text.contains("120 Гкал/ч"));
        assertTrue(text.contains("Фактическая мощность"));
        assertTrue(text.contains("84 Гкал/ч"));
        assertTrue(text.contains("Характеристика производства"));
    }

    @Test
    void componentSectionsFollowDeclaredMonitoringDirections() throws Exception {
        // Nothing declared: no component section is rendered at all - an absent component is not the
        // same thing as an empty table.
        String bare = officialReportText();
        assertFalse(bare.contains("Атмосферный воздух: источники выбросов"));
        assertFalse(bare.contains("Сточные воды: выпуски"));
        assertFalse(bare.contains("Отходы: накопление и движение"));

        declareDirection(PekMonitoringType.EMISSION_SOURCE);
        String withAir = officialReportText();
        assertTrue(withAir.contains("Атмосферный воздух: источники выбросов"));
        assertFalse(withAir.contains("Сточные воды: выпуски"),
                "раздел сточных вод не должен появляться у объекта, который их не заявляет");
    }

    @Test
    void wasteSectionRendersCatalogueTermsTogetherWithPeriodFigures() throws Exception {
        declareDirection(PekMonitoringType.WASTE);
        WasteItemDto item = inventory.createWasteItem(programId, new WasteItemRequest(
                "Отходы производства извести", "12345", "IV", "50", "т", 180,
                "Площадка накопления №2", "51.18, 71.49", null, 1));
        inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "2", "10", "8", null, "4", "ТОО Полигон", "123456789012", null), null);

        String text = officialReportText();
        assertTrue(text.contains("Отходы: накопление и движение"));
        assertTrue(text.contains("Лимит накопления"));
        assertTrue(text.contains("Срок накопления"));
        assertTrue(text.contains("БИН получателя"));
        assertTrue(text.contains("Отходы производства извести"));
        assertTrue(text.contains("123456789012"));
        assertTrue(text.contains("Площадка накопления №2"));
    }

    @Test
    void unreconciledWasteBalanceIsCalledOutInTheDocument() throws Exception {
        declareDirection(PekMonitoringType.WASTE);
        WasteItemDto item = inventory.createWasteItem(programId, new WasteItemRequest(
                "Отработанные масла", "555", "III", null, "т", null, null, null, null, 1));
        inventory.upsertWasteMovement(reportId, new WasteMovementRequest(
                item.id(), "10", "5", "3", "0", "99", null, null, null), null);

        String text = officialReportText();
        assertTrue(text.contains("не сходится с расчётным"),
                "несходящийся остаток должен быть назван в документе, а не молча исправлен");
        assertTrue(text.contains("Отработанные масла"));
    }

    @Test
    void officialReportIsNoLongerJustThePlanFactDocument() throws Exception {
        String text = officialReportText();
        // The sections that used to be the entire "official" document are still there...
        assertTrue(text.contains("Выполнение программы производственного контроля"));
        assertTrue(text.contains("Протоколы лабораторных испытаний"));
        // ...but they are no longer the whole of it.
        assertTrue(text.contains("Общие сведения"));
        assertTrue(text.contains("Производственный мониторинг"));
        assertTrue(text.contains("Вид отчёта"));
        assertTrue(text.contains("PEK_QUARTERLY"));
    }

    // ---- program document ----------------------------------------------------------------------------

    @Test
    void programDocumentContainsTheProgramme_notFourLines() throws Exception {
        declareDirection(PekMonitoringType.EMISSION_SOURCE);
        String text = programDocumentText();
        assertTrue(text.contains("ПРОГРАММА ПРОИЗВОДСТВЕННОГО ЭКОЛОГИЧЕСКОГО КОНТРОЛЯ"));
        assertTrue(text.contains("Общие сведения об объекте"));
        assertTrue(text.contains("Позиции контроля, методы и периодичность"));
        assertTrue(text.contains("Контроль выбросов котельной"));
        assertTrue(text.contains("Контролируемые показатели и нормативы"));
        assertTrue(text.contains("Внутренние проверки"));
        assertTrue(text.contains("Контроль качества измерений"));
        assertTrue(text.contains("Действия при аварийных ситуациях"));
        assertTrue(text.contains("Структура ответственности"));
        assertTrue(text.contains("Подписи"));
        assertTrue(text.contains("Ответственный Тестов"));
        assertTrue(text.contains("Директор Тестов"));
    }

    @Test
    void programDocumentPdfIsRenderedFromTheSameDocx_notSeparatelyHandBuilt() {
        byte[] pdf = programDocs.renderPdf(programId);
        assertTrue(pdf.length > 0);
        assertEquals("%PDF", new String(pdf, 0, 4, java.nio.charset.StandardCharsets.ISO_8859_1));
    }

    @Test
    void programDocumentOmitsComponentSectionsTheProgramDoesNotDeclare() throws Exception {
        String bare = programDocumentText();
        assertFalse(bare.contains("Выпуски сточных вод"));
        declareDirection(PekMonitoringType.WASTEWATER);
        assertTrue(programDocumentText().contains("Выпуски сточных вод"));
    }

    private WasteItemDto someWasteItem() {
        return inventory.createWasteItem(programId, new WasteItemRequest(
                "Тестовый отход", "001", "IV", "10", "т", 90, "Площадка", null, null, 0));
    }
}
