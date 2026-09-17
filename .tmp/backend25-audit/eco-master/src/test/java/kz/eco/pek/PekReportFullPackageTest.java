package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The full PEK package (program, report, explanatory note, measures, emissions XLSX, protocols):
 * built only when complete, from current documents, with a manifest that matches the ZIP exactly.
 */
@SpringBootTest
@Transactional
class PekReportFullPackageTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository objectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekStaffAssignmentRepository membershipRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekProgramMeasureRepository measureRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportResultRowRepository resultRowRepository;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private PekReportPackageRepository packageRepository;
    @Autowired private PekReportDocumentVersionRepository versionRepository;
    @Autowired private PekReportContentRevisionService contentRevisionService;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolResultRepository protocolResultRepository;
    @Autowired private PekCompletePackageFixture fixture;

    private MockMvc mvc;
    private User head;
    private Long reportId;
    private Long programId;
    private Long sourceId;
    private Protocol protocol;

    @BeforeEach
    void setUp() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Full Package " + System.nanoTime());
        company.setBin(String.valueOf(500000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Площадка откорма");
        object.setStatus("ACTIVE");
        objectRepository.save(object);

        head = user("full-pkg-head-", UserRole.HEAD);
        membership(company.getId(), head);

        PekProgram program = new PekProgram();
        program.setCompanyId(company.getId());
        program.setObjectId(object.getId());
        program.setNumber("ПЭК-FULL-1");
        program.setName("Программа ПЭК");
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setCreatedBy(head.getId());
        programRepository.saveAndFlush(program);
        programId = program.getId();

        PekProgramMonitoring monitoring = new PekProgramMonitoring();
        monitoring.setProgramId(programId);
        monitoring.setMonitoringType(PekMonitoringType.EMISSION_SOURCE);
        monitoring.setName("Выбросы");
        monitoring.setMethodology("МВИ 01");
        monitoring.setFrequencyType(PekFrequencyType.QUARTERLY);
        monitoring.setPlannedCount(1);
        monitoring.setActive(true);
        monitoring.setControlItemIds(new LinkedHashSet<>());
        monitoringRepository.saveAndFlush(monitoring);

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(programId);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.COLLECTING);
        report.setResponsibleUserId(head.getId());
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        reportId = report.getId();

        PekCompletePackageFixture.Complete complete = fixture.complete(reportId, head.getId(), "VPR-1");
        sourceId = complete.emissionSourceId();
        protocol = complete.protocol();
    }

    // ---- scenarios -----------------------------------------------------------------------------

    @Test
    void completePackage_containsEveryDocument_andManifestMatchesZipEntries() throws Exception {
        saveExecution(new BigDecimal("1500000"), new BigDecimal("100"), null);
        generateAllDocuments();

        mvc.perform(get(pkg("/preflight")).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(true))
                .andExpect(jsonPath("$.data.issues").isEmpty());

        String body = mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentVersion").value(1))
                .andExpect(jsonPath("$.data.missingDocuments").isEmpty())
                .andExpect(jsonPath("$.data.staleDocuments").isEmpty())
                .andExpect(jsonPath("$.data.availableActions.downloadPackage").value(true))
                .andReturn().getResponse().getContentAsString();
        List<String> manifest = JsonPath.read(body, "$.data.files");

        byte[] zip = mvc.perform(get(pkg("/download")).with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        List<String> entries = zipEntries(zip);

        assertEquals(manifest, entries, "manifest must list exactly the ZIP entries, in order");
        assertEquals(List.of(
                "01_Программа_ПЭК.docx", "01_Программа_ПЭК.pdf",
                "02_Отчёт_ПЭК.docx", "02_Отчёт_ПЭК.pdf",
                "03_Пояснительная_записка.docx", "03_Пояснительная_записка.pdf",
                "04_Природоохранные_мероприятия.docx", "04_Природоохранные_мероприятия.pdf",
                "05_ПЭК_Выбросы.xlsx",
                "06_Протоколы/VPR-1_" + protocol.getId() + ".docx",
                "06_Протоколы/VPR-1_" + protocol.getId() + ".pdf"), entries);
    }

    @Test
    void missingProtocol_isRejectedWithStructuredList_andNothingIsStored() throws Exception {
        saveExecution(new BigDecimal("1500000"), new BigDecimal("100"), null);
        generateAllDocuments();
        sourceRepository.deleteAll(sourceRepository.findByReportIdAndExcludedFalse(reportId));
        long versionsBefore = versionRepository.count();

        mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PACKAGE_NOT_READY"))
                .andExpect(jsonPath("$.errors[*].code", hasItem("PROTOCOLS_MISSING")))
                .andExpect(jsonPath("$.errors[0].section").exists())
                .andExpect(jsonPath("$.errors[0].message").exists());

        assertTrue(packageRepository.findTopByReportIdOrderByDocumentVersionDesc(reportId).isEmpty(),
                "a rejected build must not leave a package row");
        assertEquals(versionsBefore, versionRepository.count(), "a rejected build must not render documents");
    }

    @Test
    void protocolWithoutPdfOrDocx_isReportedPerFile() throws Exception {
        saveExecution(new BigDecimal("1500000"), new BigDecimal("100"), null);
        generateAllDocuments();
        protocol.setPdfFileId(null);
        protocol.setDocxFileId(null);
        protocolRepository.saveAndFlush(protocol);

        mvc.perform(get(pkg("/preflight")).with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(false))
                .andExpect(jsonPath("$.data.missingDocuments[*].code", hasItem("PROTOCOL_PDF_MISSING")))
                .andExpect(jsonPath("$.data.missingDocuments[*].code", hasItem("PROTOCOL_DOCX_MISSING")))
                .andExpect(jsonPath("$.data.missingDocuments[?(@.code == 'PROTOCOL_PDF_MISSING')].entityId")
                        .value(protocol.getId().intValue()));

        mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PACKAGE_NOT_READY"));
    }

    @Test
    void staleProtocol_andStaleDocument_blockThePackage_untilRegenerated() throws Exception {
        saveExecution(new BigDecimal("1500000"), new BigDecimal("100"), null);
        generateAllDocuments();
        protocol.setContentVersion(protocol.getContentVersion() + 1);
        protocolRepository.saveAndFlush(protocol);

        mvc.perform(get(pkg("/preflight")).with(as(head)))
                .andExpect(jsonPath("$.data.staleDocuments[*].code", hasItem("PROTOCOL_STALE")));

        protocol.setPdfSourceContentVersion(protocol.getContentVersion());
        protocolRepository.saveAndFlush(protocol);
        contentRevisionService.bump(reportRepository.findById(reportId).orElseThrow());

        mvc.perform(get(pkg("/preflight")).with(as(head)))
                .andExpect(jsonPath("$.data.ready").value(false))
                .andExpect(jsonPath("$.data.staleDocuments[*].code", hasItem("DOCUMENT_STALE")))
                .andExpect(jsonPath("$.data.files[?(@.key == 'EXPLANATORY_NOTE_PDF')].status").value("STALE"));

        generateAllDocuments();
        mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion()))
                .andExpect(status().isOk());
    }

    @Test
    void twoProtocolsWithTheSameNumber_getDistinctEntries() throws Exception {
        saveExecution(new BigDecimal("1500000"), new BigDecimal("100"), null);
        // Protocol numbers are unique, but "VPR/1" and "VPR:1" sanitise to the same ZIP name.
        Protocol first = fixture.protocol(reportId, head.getId(), "VPR/1", "%PDF a".getBytes());
        Protocol twin = fixture.protocol(reportId, head.getId(), "VPR:1", "%PDF b".getBytes());
        generateAllDocuments();

        String body = mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> files = JsonPath.read(body, "$.data.files");
        assertTrue(files.contains("06_Протоколы/VPR_1_" + first.getId() + ".pdf"));
        assertTrue(files.contains("06_Протоколы/VPR_1_" + twin.getId() + ".pdf"));
        assertEquals(files.size(), new LinkedHashSet<>(files).size());
    }

    @Test
    void emissionsXlsx_hasOfficialColumns_numericCells_andFormulas() throws Exception {
        mvc.perform(post(doc("/generate-xlsx")).with(as(head))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentType").value("EMISSIONS_XLSX"))
                .andExpect(jsonPath("$.data.hasXlsx").value(true));
        byte[] xlsx = mvc.perform(get(doc("/download/xlsx")).with(as(head)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();

        try (XSSFWorkbook book = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            Sheet sheet = book.getSheet("Выбросы");
            Row header = sheet.getRow(PekMonitoringExcelGenerationService.HEADER_ROW);
            List<String> headings = new ArrayList<>();
            for (int c = 0; c < PekMonitoringExcelGenerationService.HEADERS.size(); c++) {
                headings.add(header.getCell(c).getStringCellValue());
            }
            assertEquals(PekMonitoringExcelGenerationService.HEADERS, headings);
            assertEquals("Сверхнормативный выброс, т/год", headings.get(13));

            Row row = sheet.getRow(PekMonitoringExcelGenerationService.HEADER_ROW + 1);
            assertEquals("Котельная", row.getCell(0).getStringCellValue());
            assertEquals("0001", row.getCell(1).getStringCellValue());
            assertEquals("0301", row.getCell(3).getStringCellValue());
            assertEquals(CellType.NUMERIC, row.getCell(5).getCellType());
            assertEquals(0.01, row.getCell(5).getNumericCellValue(), 1e-9);
            assertEquals(0.2, row.getCell(6).getNumericCellValue(), 1e-9);
            assertEquals(0.16, row.getCell(9).getNumericCellValue(), 1e-9);
            assertEquals(CellType.FORMULA, row.getCell(13).getCellType());
            assertEquals(CellType.FORMULA, row.getCell(14).getCellType());
            assertEquals(43.2975, row.getCell(16).getNumericCellValue(), 1e-9);
            assertEquals(68.2512, row.getCell(17).getNumericCellValue(), 1e-9);
            assertEquals(PekMonitoringExcelGenerationService.HEADER_ROW + 1, sheet.getPaneInformation().getHorizontalSplitTopRow());
            assertTrue(sheet.getRepeatingRows() != null, "header must repeat on printed pages");
        }
    }

    @Test
    void emissionAboveNormative_requiresIncreaseReason_beforeXlsx() throws Exception {
        resultRowRepository.deleteAll(resultRowRepository.findByReportIdOrderBySectionTypeAscIndicatorNameAsc(reportId));
        resultRowRepository.flush();
        resultRow(protocol, "0301", "Азота диоксид", "0.0100", "0.2000", "0.0150", "0.0800", "0.3200");

        mvc.perform(post(doc("/generate-xlsx")).with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_NOT_READY"))
                .andExpect(jsonPath("$.errors[0].code").value("INCREASE_REASON_REQUIRED"))
                .andExpect(jsonPath("$.errors[0].field").value("increaseReason"))
                .andExpect(jsonPath("$.errors[0].entityId").value(sourceId.intValue()));

        mvc.perform(put("/api/pek/reports/" + reportId + "/emission-balances").with(as(head))
                        .header("If-Match", reportVersion()).contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"emissionSourceId\":" + sourceId + ",\"substanceCode\":\"0301\","
                                + "\"capturedTons\":0.5,\"utilizedTons\":0.2,\"increaseReason\":\"Рост поголовья\"}]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].increaseReasonRequired").value(true))
                .andExpect(jsonPath("$.data[0].increaseReason").value("Рост поголовья"));

        mvc.perform(post(doc("/generate-xlsx")).with(as(head))).andExpect(status().isOk());
    }

    @Test
    void explanatoryNote_withEmptySection_isRefusedWithExactField() throws Exception {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setConclusion(null);
        reportRepository.saveAndFlush(report);

        mvc.perform(post(doc("/generate-docx")).param("documentType", "EXPLANATORY_NOTE").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_DOCUMENT_NOT_READY"))
                .andExpect(jsonPath("$.errors[0].section").value("EXPLANATORY_NOTE"))
                .andExpect(jsonPath("$.errors[0].field").value("report.conclusion"));
    }

    @Test
    void unfinishedMeasure_requiresNonCompletionReason() throws Exception {
        saveExecution(new BigDecimal("700000"), new BigDecimal("50"), null);
        mvc.perform(post(doc("/generate-pdf")).param("documentType", "ENVIRONMENTAL_MEASURES").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].code").value("NON_COMPLETION_REASON_REQUIRED"));

        saveExecution(new BigDecimal("700000"), new BigDecimal("50"), "Поставщик сорвал сроки");
        mvc.perform(post(doc("/generate-pdf")).param("documentType", "ENVIRONMENTAL_MEASURES").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasDocx").value(true))
                .andExpect(jsonPath("$.data.hasPdf").value(true));
    }

    @Test
    void otherCompanysUser_cannotSeeOrBuildThePackage() throws Exception {
        Company other = new Company();
        other.setName("ТОО Чужая " + System.nanoTime());
        other.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 99999999999L)));
        other.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(other);
        User stranger = user("full-pkg-stranger-", UserRole.HEAD);
        membership(other.getId(), stranger);

        mvc.perform(get(pkg("/preflight")).with(as(stranger))).andExpect(status().isForbidden());
        mvc.perform(post(pkg("/generate")).with(as(stranger)).header("If-Match", reportVersion()))
                .andExpect(status().isForbidden());
        mvc.perform(post(doc("/generate-xlsx")).with(as(stranger))).andExpect(status().isForbidden());
        mvc.perform(get("/api/pek/reports/" + reportId + "/measure-executions").with(as(stranger)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staleIfMatch_isAVersionConflict() throws Exception {
        mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion() - 1))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
        mvc.perform(put("/api/pek/reports/" + reportId + "/measure-executions").with(as(head))
                        .header("If-Match", reportVersion() + 5).contentType(MediaType.APPLICATION_JSON).content("[]"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("OPTIMISTIC_LOCK_CONFLICT"));
    }

    @Test
    void signedReport_cannotRegenerateDocumentsOrPackage() throws Exception {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.SIGNED);
        reportRepository.saveAndFlush(report);
        long versionsBefore = versionRepository.count();

        mvc.perform(post(doc("/generate-docx")).param("documentType", "EXPLANATORY_NOTE").with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DOCUMENT_LOCKED"));
        mvc.perform(post(doc("/generate-xlsx")).with(as(head)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DOCUMENT_LOCKED"));
        mvc.perform(post(pkg("/generate")).with(as(head)).header("If-Match", reportVersion()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DOCUMENT_LOCKED"));
        assertEquals(versionsBefore, versionRepository.count());
    }

    // ---- fixtures ------------------------------------------------------------------------------

    private void generateAllDocuments() throws Exception {
        mvc.perform(post(doc("/generate-pdf")).with(as(head))).andExpect(status().isOk());
        mvc.perform(post(doc("/generate-docx")).param("documentType", "EXPLANATORY_NOTE").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.documentType").value("EXPLANATORY_NOTE"))
                .andExpect(jsonPath("$.data.hasPdf").value(true));
        mvc.perform(post(doc("/generate-docx")).param("documentType", "ENVIRONMENTAL_MEASURES").with(as(head)))
                .andExpect(status().isOk());
        mvc.perform(post(doc("/generate-xlsx")).with(as(head))).andExpect(status().isOk());
    }

    private void saveExecution(BigDecimal actual, BigDecimal percent, String reason) throws Exception {
        Long measureId = measureRepository.findByProgramIdOrderByPlannedStartDateAsc(programId).getFirst().getId();
        mvc.perform(put("/api/pek/reports/" + reportId + "/measure-executions").with(as(head))
                        .header("If-Match", reportVersion()).contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"measureId\":" + measureId + ",\"actualAmount\":" + actual
                                + ",\"completionPercent\":" + percent + ",\"status\":\"IN_PROGRESS\""
                                + (reason == null ? "" : ",\"nonCompletionReason\":\"" + reason + "\"") + "}]"))
                .andExpect(status().isOk());
    }

    private void resultRow(Protocol p, String code, String name, String normGs, String normTy,
                           String actGs, String actTq, String actTy) {
        PekReportResultRow row = new PekReportResultRow();
        row.setReportId(reportId);
        row.setSectionType(PekOfficialTableType.EMISSIONS);
        row.setMonitoringType(PekMonitoringType.EMISSION_SOURCE);
        row.setEmissionSourceId(sourceId);
        row.setProtocolId(p.getId());
        row.setProtocolResultId(protocolResultRepository.findByProtocolIdOrderByRowNumberAsc(p.getId()).getFirst().getId());
        row.setIndicatorCode(code);
        row.setIndicatorName(name);
        row.setNormativeGs(new BigDecimal(normGs));
        row.setNormativeTonsYear(new BigDecimal(normTy));
        row.setActualGs(new BigDecimal(actGs));
        row.setActualTonsQuarter(new BigDecimal(actTq));
        row.setActualTonsYear(new BigDecimal(actTy));
        resultRowRepository.saveAndFlush(row);
    }

    private static List<String> zipEntries(byte[] zip) throws Exception {
        List<String> names = new ArrayList<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), java.nio.charset.StandardCharsets.UTF_8)) {
            for (ZipEntry e = in.getNextEntry(); e != null; e = in.getNextEntry()) {
                names.add(e.getName());
            }
        }
        return names;
    }

    private String pkg(String suffix) {
        return "/api/pek/reports/" + reportId + "/package" + suffix;
    }

    private String doc(String suffix) {
        return "/api/pek/reports/" + reportId + "/document" + suffix;
    }

    private Long reportVersion() {
        return reportRepository.findById(reportId).orElseThrow().getVersion();
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash("test");
        u.setName("Ответственный " + role.name());
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private void membership(Long companyId, User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }
}
