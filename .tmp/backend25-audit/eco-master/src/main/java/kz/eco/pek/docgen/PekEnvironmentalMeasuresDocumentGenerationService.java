package kz.eco.pek.docgen;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.pek.PekMeasureStatus;
import kz.eco.pek.PekPackagePolicy;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekProgramMeasure;
import kz.eco.pek.PekProgramMeasureRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekReport;
import kz.eco.pek.PekReportDocumentType;
import kz.eco.pek.PekReportDocumentVersion;
import kz.eco.pek.PekReportMeasureExecution;
import kz.eco.pek.PekReportMeasureExecutionRepository;
import kz.eco.pek.dto.PekMonitoringDtos.PackageIssue;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static kz.eco.pek.docgen.PekDocLabels.blank;

/**
 * Отчёт о выполнении природоохранных мероприятий за период: DOCX + PDF from one snapshot, stored as
 * a {@link PekReportDocumentType#ENVIRONMENTAL_MEASURES} version.
 *
 * <p>Rows are the program's measures whose planned period overlaps the report period (a measure
 * without dates belongs to every period). Plan columns come from {@link PekProgramMeasure}, actual
 * figures from this report's {@link PekReportMeasureExecution}.
 */
@Service
public class PekEnvironmentalMeasuresDocumentGenerationService {

    static final String SECTION = "MEASURES";

    private final PekReportDocumentStore store;
    private final PekPackagePolicy packagePolicy;
    private final PekProgramRepository programRepository;
    private final PekProgramMeasureRepository measureRepository;
    private final PekReportMeasureExecutionRepository executionRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository objectRepository;
    private final UserRepository userRepository;

    public PekEnvironmentalMeasuresDocumentGenerationService(PekReportDocumentStore store,
                                                             PekPackagePolicy packagePolicy,
                                                             PekProgramRepository programRepository,
                                                             PekProgramMeasureRepository measureRepository,
                                                             PekReportMeasureExecutionRepository executionRepository,
                                                             CompanyRepository companyRepository,
                                                             CompanyObjectRepository objectRepository,
                                                             UserRepository userRepository) {
        this.store = store;
        this.packagePolicy = packagePolicy;
        this.programRepository = programRepository;
        this.measureRepository = measureRepository;
        this.executionRepository = executionRepository;
        this.companyRepository = companyRepository;
        this.objectRepository = objectRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public PekReportDocumentVersion generate(Long reportId, Long userId) {
        PekReport report = store.lockForGeneration(reportId);
        packagePolicy.requireCanGenerate(report);
        PekProgram program = program(report);
        PekReportDocumentStore.requireNoIssues(issues(report, program), "Природоохранные мероприятия");

        PekEnvironmentalMeasuresDocxRenderer.Values values = buildValues(report, program);
        byte[] docx;
        try {
            docx = PekEnvironmentalMeasuresDocxRenderer.render(values);
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать отчёт о мероприятиях: " + e.getMessage());
        }
        byte[] pdf = PekReportPdfConverter.convert(docx);
        return store.store(report, program, PekReportDocumentType.ENVIRONMENTAL_MEASURES, values,
                new PekReportDocumentStore.Rendered(docx, pdf, null), "pek-environmental-measures", userId);
    }

    @Transactional(readOnly = true)
    public List<PackageIssue> issues(PekReport report) {
        return issues(report, program(report));
    }

    /** Measures of the program that belong to the report period, in plan order. */
    public List<PekProgramMeasure> measuresFor(PekReport report) {
        return measureRepository.findByProgramIdOrderByPlannedStartDateAsc(report.getProgramId()).stream()
                .filter(m -> m.getStatus() != PekMeasureStatus.CANCELLED)
                .filter(m -> (m.getPlannedStartDate() == null || !m.getPlannedStartDate().isAfter(report.getPeriodEnd()))
                        && (m.getPlannedEndDate() == null || !m.getPlannedEndDate().isBefore(report.getPeriodStart())))
                .toList();
    }

    private List<PackageIssue> issues(PekReport report, PekProgram program) {
        List<PackageIssue> issues = new ArrayList<>();
        Map<Long, PekReportMeasureExecution> executions = executions(report);
        for (PekProgramMeasure m : measuresFor(report)) {
            String label = "«" + m.getName() + "»";
            if (blank(m.getWorkVolume())) {
                issues.add(issue("FIELD_REQUIRED", m.getId(), "measure.workVolume",
                        "Не указан объём работ мероприятия " + label));
            }
            if (blank(m.getEnvironmentalEffect())) {
                issues.add(issue("FIELD_REQUIRED", m.getId(), "measure.environmentalEffect",
                        "Не указан экологический эффект мероприятия " + label));
            }
            PekReportMeasureExecution e = executions.get(m.getId());
            if (e == null) {
                issues.add(issue("MEASURE_EXECUTION_MISSING", m.getId(), "execution",
                        "Не внесено выполнение за период по мероприятию " + label));
                continue;
            }
            if (m.getPlannedBudget() != null && e.getActualAmount() == null) {
                issues.add(issue("FIELD_REQUIRED", m.getId(), "execution.actualAmount",
                        "Не указана освоенная сумма по мероприятию " + label));
            }
            if (e.getCompletionPercent() == null) {
                issues.add(issue("FIELD_REQUIRED", m.getId(), "execution.completionPercent",
                        "Не указан процент выполнения по мероприятию " + label));
            } else if (e.getCompletionPercent().compareTo(BigDecimal.valueOf(100)) < 0
                    && dueWithinPeriod(m, report) && blank(e.getNonCompletionReason())) {
                issues.add(issue("NON_COMPLETION_REASON_REQUIRED", m.getId(), "execution.nonCompletionReason",
                        "Мероприятие " + label + " выполнено не полностью - укажите причину невыполнения"));
            }
        }
        return issues;
    }

    /** A measure due by the end of this period that is not 100% done must explain why. */
    private static boolean dueWithinPeriod(PekProgramMeasure m, PekReport report) {
        return m.getPlannedEndDate() != null && !m.getPlannedEndDate().isAfter(report.getPeriodEnd());
    }

    private Map<Long, PekReportMeasureExecution> executions(PekReport report) {
        return executionRepository.findByReportId(report.getId()).stream()
                .collect(Collectors.toMap(PekReportMeasureExecution::getMeasureId, Function.identity(), (a, b) -> a));
    }

    private PekEnvironmentalMeasuresDocxRenderer.Values buildValues(PekReport report, PekProgram program) {
        Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        CompanyObject object = objectRepository.findById(report.getObjectId()).orElse(null);
        User responsible = report.getResponsibleUserId() == null ? null
                : userRepository.findById(report.getResponsibleUserId()).orElse(null);
        Map<Long, PekReportMeasureExecution> executions = executions(report);

        List<PekEnvironmentalMeasuresDocxRenderer.Row> rows = new ArrayList<>();
        BigDecimal totalPlanned = BigDecimal.ZERO;
        BigDecimal totalActual = BigDecimal.ZERO;
        int n = 1;
        for (PekProgramMeasure m : measuresFor(report)) {
            PekReportMeasureExecution e = executions.get(m.getId());
            BigDecimal actual = e == null ? null : e.getActualAmount();
            if (m.getPlannedBudget() != null) totalPlanned = totalPlanned.add(m.getPlannedBudget());
            if (actual != null) totalActual = totalActual.add(actual);
            rows.add(new PekEnvironmentalMeasuresDocxRenderer.Row(
                    String.valueOf(n++), m.getName(), m.getWorkVolume(),
                    period(m), money(m.getPlannedBudget(), m.getCurrency()), money(actual, m.getCurrency()),
                    PekDocLabels.number(percent(actual, m.getPlannedBudget())),
                    e == null ? null : PekDocLabels.number(e.getCompletionPercent()),
                    m.getEnvironmentalEffect(),
                    PekDocLabels.measureStatus(e == null ? m.getStatus() : e.getStatus()),
                    note(e)));
        }
        return new PekEnvironmentalMeasuresDocxRenderer.Values(
                report.getId() + "/" + report.getPeriodKey(), store.nextVersion(report.getId()),
                PekDocLabels.period(report), company == null ? null : company.getName(),
                object == null ? null : object.getName(), program.getNumber(),
                LocalDateTime.now().format(PekDocLabels.DATE_TIME), rows,
                PekDocLabels.number(totalPlanned), PekDocLabels.number(totalActual),
                PekDocLabels.number(percent(totalActual, totalPlanned)),
                responsible == null ? null : responsible.getName(),
                company == null ? null : company.getDirectorName());
    }

    /** Share of the planned amount actually spent, one decimal; null when there is no plan. */
    static BigDecimal percent(BigDecimal actual, BigDecimal planned) {
        if (actual == null || planned == null || planned.signum() == 0) return null;
        return actual.multiply(BigDecimal.valueOf(100)).divide(planned, 1, RoundingMode.HALF_UP);
    }

    private static String money(BigDecimal amount, String currency) {
        String n = PekDocLabels.number(amount);
        return n == null || blank(currency) ? n : n + " " + currency;
    }

    private static String period(PekProgramMeasure m) {
        String from = PekDocLabels.date(m.getPlannedStartDate());
        String to = PekDocLabels.date(m.getPlannedEndDate());
        if (from == null && to == null) return null;
        return (from == null ? "" : from) + " — " + (to == null ? "" : to);
    }

    private static String note(PekReportMeasureExecution e) {
        if (e == null) return null;
        if (blank(e.getNonCompletionReason())) return e.getNote();
        if (blank(e.getNote())) return "Причина невыполнения: " + e.getNonCompletionReason();
        return e.getNote() + ". Причина невыполнения: " + e.getNonCompletionReason();
    }

    private static PackageIssue issue(String code, Long measureId, String field, String message) {
        return new PackageIssue(code, SECTION, measureId, field, message);
    }

    private PekProgram program(PekReport report) {
        return programRepository.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
    }
}
