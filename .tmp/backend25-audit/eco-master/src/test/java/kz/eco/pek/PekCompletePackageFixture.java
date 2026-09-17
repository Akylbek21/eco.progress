package kz.eco.pek;

import kz.eco.company.CompanyRepository;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.storage.FileStorageService;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Synthetic data that makes a PEK report's full package buildable: the narrative fields of the
 * explanatory note, one emission source with a measured substance, one environmental measure with
 * its execution, and complete industrial-emission protocols. Tests start from a complete report and
 * break exactly the thing they are about.
 */
@Component
public class PekCompletePackageFixture {

    private final PekProgramRepository programs;
    private final PekReportRepository reports;
    private final PekEmissionSourceRepository emissionSources;
    private final PekProgramMeasureRepository measures;
    private final PekReportMeasureExecutionRepository executions;
    private final PekReportResultRowRepository resultRows;
    private final PekReportProtocolSourceRepository sources;
    private final ProtocolRepository protocols;
    private final ProtocolResultRepository protocolResults;
    private final ProtocolTemplateRepository templates;
    private final CompanyRepository companies;
    private final FileStorageService storage;

    public PekCompletePackageFixture(PekProgramRepository programs, PekReportRepository reports,
                                     PekEmissionSourceRepository emissionSources, PekProgramMeasureRepository measures,
                                     PekReportMeasureExecutionRepository executions,
                                     PekReportResultRowRepository resultRows, PekReportProtocolSourceRepository sources,
                                     ProtocolRepository protocols, ProtocolResultRepository protocolResults,
                                     ProtocolTemplateRepository templates, CompanyRepository companies,
                                     FileStorageService storage) {
        this.programs = programs;
        this.reports = reports;
        this.emissionSources = emissionSources;
        this.measures = measures;
        this.executions = executions;
        this.resultRows = resultRows;
        this.sources = sources;
        this.protocols = protocols;
        this.protocolResults = protocolResults;
        this.templates = templates;
        this.companies = companies;
        this.storage = storage;
    }

    /** Created ids a test may want to break. */
    public record Complete(Long emissionSourceId, Long measureId, Protocol protocol) {}

    /**
     * Fills program and report narrative, adds a source, a measure (100% done) and one complete
     * industrial-emission protocol numbered {@code protocolNumber} with a result row. Does not
     * generate documents - that needs an authenticated request, see {@link #generateDocuments}.
     */
    public Complete complete(Long reportId, Long userId, String protocolNumber) {
        PekReport report = reports.findById(reportId).orElseThrow();
        PekProgram program = programs.findById(report.getProgramId()).orElseThrow();
        program.setProductionCharacteristics("Откормочная площадка КРС");
        program.setTechnologicalProcess("Приём, откорм и отгрузка скота");
        program.setDesignCapacity("50000");
        program.setDesignCapacityUnit("голов");
        program.setMainImpactSources("Котельная, кормоцех");
        programs.saveAndFlush(program);

        report.setActualCapacity("48000 голов");
        report.setPerformedStudies("Инструментальные замеры выбросов");
        report.setMonitoringResultsSummary("Выбросы в пределах нормативов");
        report.setConclusion("Нарушений не выявлено");
        reports.saveAndFlush(report);

        companies.findById(report.getCompanyId()).ifPresent(c -> {
            c.setDirectorName("Директоров Д.Д.");
            companies.saveAndFlush(c);
        });

        PekEmissionSource source = new PekEmissionSource();
        source.setProgramId(program.getId());
        source.setCode("0001");
        source.setName("Труба котельной");
        source.setWorkshopName("Котельная");
        source.setCoordinates("43.2975, 68.2512");
        emissionSources.saveAndFlush(source);

        PekProgramMeasure measure = new PekProgramMeasure();
        measure.setProgramId(program.getId());
        measure.setCode("М-1");
        measure.setName("Замена фильтров");
        measure.setPlannedStartDate(report.getPeriodStart());
        measure.setPlannedEndDate(report.getPeriodEnd());
        measure.setPlannedBudget(new BigDecimal("1000000"));
        measure.setCurrency("KZT");
        measure.setWorkVolume("2 фильтра");
        measure.setEnvironmentalEffect("Снижение выбросов пыли");
        measures.saveAndFlush(measure);

        PekReportMeasureExecution execution = new PekReportMeasureExecution();
        execution.setReportId(reportId);
        execution.setMeasureId(measure.getId());
        execution.setActualAmount(new BigDecimal("1000000"));
        execution.setCompletionPercent(new BigDecimal("100"));
        execution.setStatus(PekMeasureStatus.COMPLETED);
        executions.saveAndFlush(execution);

        Protocol protocol = protocol(reportId, userId, protocolNumber,
                ("%PDF " + protocolNumber).getBytes(StandardCharsets.UTF_8));
        PekReportResultRow row = new PekReportResultRow();
        row.setReportId(reportId);
        row.setSectionType(PekOfficialTableType.EMISSIONS);
        row.setMonitoringType(PekMonitoringType.EMISSION_SOURCE);
        row.setEmissionSourceId(source.getId());
        row.setProtocolId(protocol.getId());
        row.setProtocolResultId(protocolResults.findByProtocolIdOrderByRowNumberAsc(protocol.getId()).getFirst().getId());
        row.setIndicatorCode("0301");
        row.setIndicatorName("Азота диоксид");
        row.setNormativeGs(new BigDecimal("0.01"));
        row.setNormativeTonsYear(new BigDecimal("0.2"));
        row.setActualGs(new BigDecimal("0.008"));
        row.setActualTonsQuarter(new BigDecimal("0.04"));
        row.setActualTonsYear(new BigDecimal("0.16"));
        resultRows.saveAndFlush(row);
        return new Complete(source.getId(), measure.getId(), protocol);
    }

    /** An approved industrial-emission protocol with DOCX, the given PDF bytes (null = no PDF), a
     *  methodology, laboratory, executor and one result with its normative, linked to the report. */
    public Protocol protocol(Long reportId, Long userId, String number, byte[] pdf) {
        PekReport report = reports.findById(reportId).orElseThrow();
        Protocol p = new Protocol();
        p.setTemplateId(templates.findByCode("INDUSTRIAL_EMISSIONS").orElseThrow().getId());
        p.setTemplateCode("INDUSTRIAL_EMISSIONS");
        p.setProtocolNumber(number);
        p.setProtocolDate(report.getPeriodStart().plusDays(20));
        p.setCompanyId(report.getCompanyId());
        p.setObjectId(report.getObjectId());
        p.setStatus(ProtocolStatus.APPROVED);
        p.setCreatedBy(userId);
        p.setLaboratoryName("ИЛ ЭкоПрогресс");
        p.setExecutorName("Лаборант Л.Л.");
        p.setTestingMethodNd("МВИ 01");
        p.setDocxFileId(store(("docx " + number).getBytes(StandardCharsets.UTF_8), "protocol.docx"));
        p.setPdfFileId(pdf == null ? null : store(pdf, "protocol.pdf"));
        p.setContentVersion(1L);
        p.setPdfSourceContentVersion(1L);
        protocols.saveAndFlush(p);

        ProtocolResult r = new ProtocolResult();
        r.setProtocolId(p.getId());
        r.setRowNumber(1);
        r.setIndicatorName("Азота диоксид");
        r.setResultGs(new BigDecimal("0.008"));
        r.setPdvGs(new BigDecimal("0.01"));
        protocolResults.saveAndFlush(r);

        PekReportProtocolSource s = new PekReportProtocolSource();
        s.setReportId(reportId);
        s.setProgramId(report.getProgramId());
        s.setProtocolId(p.getId());
        sources.saveAndFlush(s);
        return p;
    }

    public String store(byte[] bytes, String name) {
        try {
            return storage.storeBytes(bytes, name, "application/octet-stream", "test-package", "1").fileId();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Official report, explanatory note, measures report and emissions table, through the API. */
    public void generateDocuments(MockMvc mvc, Long reportId, RequestPostProcessor as) throws Exception {
        String base = "/api/pek/reports/" + reportId + "/document";
        mvc.perform(post(base + "/generate-pdf").with(as)).andExpect(status().isOk());
        mvc.perform(post(base + "/generate-docx").param("documentType", "EXPLANATORY_NOTE").with(as))
                .andExpect(status().isOk());
        mvc.perform(post(base + "/generate-docx").param("documentType", "ENVIRONMENTAL_MEASURES").with(as))
                .andExpect(status().isOk());
        mvc.perform(post(base + "/generate-xlsx").with(as)).andExpect(status().isOk());
    }

    /** {@link #complete} plus {@link #generateDocuments}. */
    public Complete buildable(MockMvc mvc, Long reportId, Long userId, RequestPostProcessor as) throws Exception {
        Complete c = complete(reportId, userId, "VPR-1");
        generateDocuments(mvc, reportId, as);
        return c;
    }
}
