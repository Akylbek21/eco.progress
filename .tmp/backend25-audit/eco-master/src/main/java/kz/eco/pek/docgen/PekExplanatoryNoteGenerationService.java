package kz.eco.pek.docgen;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.pek.PekDischargeSourceRepository;
import kz.eco.pek.PekEmissionSourceRepository;
import kz.eco.pek.PekMonitoringPoint;
import kz.eco.pek.PekMonitoringPointRepository;
import kz.eco.pek.PekPackagePolicy;
import kz.eco.pek.PekProgram;
import kz.eco.pek.PekProgramIndicator;
import kz.eco.pek.PekProgramIndicatorRepository;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekReport;
import kz.eco.pek.PekReportDocumentType;
import kz.eco.pek.PekReportDocumentVersion;
import kz.eco.pek.PekReportExceedance;
import kz.eco.pek.PekReportExceedanceRepository;
import kz.eco.pek.PekReportPlanFactRow;
import kz.eco.pek.PekReportPlanFactRowRepository;
import kz.eco.pek.PekReportProtocolSource;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.pek.PekWasteItemRepository;
import kz.eco.pek.dto.PekMonitoringDtos.PackageIssue;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static kz.eco.pek.docgen.PekDocLabels.blank;

/**
 * Пояснительная записка к отчёту ПЭК: DOCX and a PDF converted from those same bytes, stored as one
 * {@link PekReportDocumentType#EXPLANATORY_NOTE} version.
 *
 * <p>The facility description, technological process and impact sources come from the program; what
 * was studied, what the monitoring showed, the exceedances and the conclusion are written per
 * period on the report. Structured data (monitoring directions, protocols, plan/fact, exceedances)
 * is printed from the records themselves. Nothing is filled in on the user's behalf: every empty
 * required section is returned by {@link #issues} with its exact field, and generation is refused.
 */
@Service
public class PekExplanatoryNoteGenerationService {

    static final String SECTION = "EXPLANATORY_NOTE";

    private final PekReportDocumentStore store;
    private final PekPackagePolicy packagePolicy;
    private final PekProgramRepository programRepository;
    private final CompanyRepository companyRepository;
    private final CompanyObjectRepository objectRepository;
    private final UserRepository userRepository;
    private final PekProgramMonitoringRepository monitoringRepository;
    private final PekMonitoringPointRepository pointRepository;
    private final PekEmissionSourceRepository emissionSourceRepository;
    private final PekDischargeSourceRepository dischargeSourceRepository;
    private final PekWasteItemRepository wasteItemRepository;
    private final PekReportProtocolSourceRepository sourceRepository;
    private final ProtocolRepository protocolRepository;
    private final PekReportPlanFactRowRepository planFactRepository;
    private final PekReportExceedanceRepository exceedanceRepository;
    private final PekProgramIndicatorRepository indicatorRepository;

    public PekExplanatoryNoteGenerationService(PekReportDocumentStore store, PekPackagePolicy packagePolicy,
                                               PekProgramRepository programRepository,
                                               CompanyRepository companyRepository,
                                               CompanyObjectRepository objectRepository,
                                               UserRepository userRepository,
                                               PekProgramMonitoringRepository monitoringRepository,
                                               PekMonitoringPointRepository pointRepository,
                                               PekEmissionSourceRepository emissionSourceRepository,
                                               PekDischargeSourceRepository dischargeSourceRepository,
                                               PekWasteItemRepository wasteItemRepository,
                                               PekReportProtocolSourceRepository sourceRepository,
                                               ProtocolRepository protocolRepository,
                                               PekReportPlanFactRowRepository planFactRepository,
                                               PekReportExceedanceRepository exceedanceRepository,
                                               PekProgramIndicatorRepository indicatorRepository) {
        this.store = store;
        this.packagePolicy = packagePolicy;
        this.programRepository = programRepository;
        this.companyRepository = companyRepository;
        this.objectRepository = objectRepository;
        this.userRepository = userRepository;
        this.monitoringRepository = monitoringRepository;
        this.pointRepository = pointRepository;
        this.emissionSourceRepository = emissionSourceRepository;
        this.dischargeSourceRepository = dischargeSourceRepository;
        this.wasteItemRepository = wasteItemRepository;
        this.sourceRepository = sourceRepository;
        this.protocolRepository = protocolRepository;
        this.planFactRepository = planFactRepository;
        this.exceedanceRepository = exceedanceRepository;
        this.indicatorRepository = indicatorRepository;
    }

    @Transactional
    public PekReportDocumentVersion generate(Long reportId, Long userId) {
        PekReport report = store.lockForGeneration(reportId);
        packagePolicy.requireCanGenerate(report);
        PekProgram program = program(report);
        PekReportDocumentStore.requireNoIssues(issues(report, program), "Пояснительная записка");

        PekExplanatoryNoteDocValues values = buildValues(report, program);
        byte[] docx;
        try {
            docx = PekExplanatoryNoteDocxRenderer.render(values);
        } catch (IOException e) {
            throw new BadRequestException("Не удалось сформировать пояснительную записку: " + e.getMessage());
        }
        byte[] pdf = PekReportPdfConverter.convert(docx);
        return store.store(report, program, PekReportDocumentType.EXPLANATORY_NOTE, values,
                new PekReportDocumentStore.Rendered(docx, pdf, null), "pek-explanatory-note", userId);
    }

    /** Every required section that is still empty, with the entity and field to fill. */
    @Transactional(readOnly = true)
    public List<PackageIssue> issues(PekReport report) {
        return issues(report, program(report));
    }

    private List<PackageIssue> issues(PekReport report, PekProgram program) {
        List<PackageIssue> issues = new ArrayList<>();
        Long pid = program.getId();
        Long rid = report.getId();
        require(issues, program.getProductionCharacteristics(), pid, "program.productionCharacteristics",
                "Не заполнена характеристика предприятия и производства (программа ПЭК)");
        require(issues, program.getTechnologicalProcess(), pid, "program.technologicalProcess",
                "Не заполнено описание технологического процесса (программа ПЭК)");
        require(issues, program.getDesignCapacity(), pid, "program.designCapacity",
                "Не указана проектная мощность (программа ПЭК)");
        require(issues, program.getMainImpactSources(), pid, "program.mainImpactSources",
                "Не описаны основные источники воздействия (программа ПЭК)");
        require(issues, report.getActualCapacity(), rid, "report.actualCapacity",
                "Не указана фактическая мощность за отчётный период");
        require(issues, report.getPerformedStudies(), rid, "report.performedStudies",
                "Не описаны выполненные исследования за период");
        require(issues, report.getMonitoringResultsSummary(), rid, "report.monitoringResultsSummary",
                "Не описаны результаты производственного мониторинга");
        if (!exceedanceRepository.findByReportId(rid).isEmpty()) {
            require(issues, report.getExceedancesSummary(), rid, "report.exceedancesSummary",
                    "За период есть превышения - опишите их в пояснительной записке");
            require(issues, report.getMeasuresTaken(), rid, "report.measuresTaken",
                    "За период есть превышения - укажите принятые меры");
        }
        require(issues, report.getConclusion(), rid, "report.conclusion", "Не заполнен итоговый вывод за период");
        if (report.getResponsibleUserId() == null) {
            issues.add(new PackageIssue("RESPONSIBLE_REQUIRED", SECTION, rid, "report.responsibleUserId",
                    "Не назначен ответственный за отчёт"));
        }
        return issues;
    }

    private static void require(List<PackageIssue> issues, String value, Long entityId, String field, String message) {
        if (blank(value)) {
            issues.add(new PackageIssue("FIELD_REQUIRED", SECTION, entityId, field, message));
        }
    }

    private PekExplanatoryNoteDocValues buildValues(PekReport report, PekProgram program) {
        Company company = companyRepository.findById(report.getCompanyId()).orElse(null);
        CompanyObject object = objectRepository.findById(report.getObjectId()).orElse(null);
        User responsible = report.getResponsibleUserId() == null ? null
                : userRepository.findById(report.getResponsibleUserId()).orElse(null);

        Map<Long, List<PekMonitoringPoint>> points = pointRepository.findByProgramIdOrderByIdAsc(program.getId())
                .stream().collect(Collectors.groupingBy(PekMonitoringPoint::getMonitoringId));
        List<PekExplanatoryNoteDocValues.MonitoringRow> monitoring =
                monitoringRepository.findByProgramIdAndActiveTrueOrderByMonitoringTypeAsc(program.getId()).stream()
                        .map(d -> new PekExplanatoryNoteDocValues.MonitoringRow(
                                PekDocLabels.monitoringType(d.getMonitoringType()), d.getName(), d.getMethodology(),
                                points.getOrDefault(d.getId(), List.of()).stream()
                                        .map(PekMonitoringPoint::getName).collect(Collectors.joining(", "))))
                        .toList();

        List<Long> protocolIds = sourceRepository.findByReportIdAndExcludedFalse(report.getId()).stream()
                .map(PekReportProtocolSource::getProtocolId).distinct().toList();
        List<PekExplanatoryNoteDocValues.ProtocolRow> protocols = protocolRepository.findAllById(protocolIds).stream()
                .map(p -> new PekExplanatoryNoteDocValues.ProtocolRow(p.getProtocolNumber(),
                        PekDocLabels.date(p.getProtocolDate()), p.getLaboratoryName()))
                .toList();

        List<PekReportPlanFactRow> planFact = planFactRepository.findByReportIdOrderByControlItemIdAsc(report.getId());
        int planned = planFact.stream().mapToInt(PekReportPlanFactRow::getPlannedCount).sum();
        int completed = planFact.stream().mapToInt(r -> Math.min(r.getActualCount(), r.getPlannedCount())).sum();

        Map<Long, String> indicatorNames = indicatorRepository.findByProgramIdOrderBySortOrderAsc(program.getId())
                .stream().collect(Collectors.toMap(PekProgramIndicator::getId,
                        i -> i.getIndicatorName() == null ? "" : i.getIndicatorName(), (a, b) -> a));
        List<PekExplanatoryNoteDocValues.ExceedanceRow> exceedances = exceedanceRepository.findByReportId(report.getId())
                .stream()
                .map((PekReportExceedance e) -> new PekExplanatoryNoteDocValues.ExceedanceRow(
                        indicatorNames.getOrDefault(e.getProgramIndicatorId(), "показатель #" + e.getProgramIndicatorId()),
                        PekDocLabels.number(e.getActualValue()), PekDocLabels.number(e.getNormativeValue()),
                        PekDocLabels.number(e.getExceedanceRatio()), PekDocLabels.exceedanceStatus(e.getStatus()),
                        e.getCorrectiveAction()))
                .toList();

        return new PekExplanatoryNoteDocValues(
                report.getId() + "/" + report.getPeriodKey(), store.nextVersion(report.getId()),
                PekDocLabels.period(report), PekDocLabels.date(report.getPeriodStart()),
                PekDocLabels.date(report.getPeriodEnd()), LocalDateTime.now().format(PekDocLabels.DATE_TIME),
                company == null ? null : company.getName(),
                firstNonBlank(program.getBinSnapshot(), company == null ? null : company.getBin()),
                company == null ? null : company.getLegalAddress(),
                object == null ? null : object.getName(), object == null ? null : object.getAddress(),
                program.getKato(), program.getOked(), program.getEnvironmentalCategory(),
                program.getNumber(), program.getName(),
                program.getFacilityInformation(), program.getProductionCharacteristics(),
                program.getTechnologicalProcess(),
                withUnit(program.getDesignCapacity(), program.getDesignCapacityUnit()),
                withUnit(report.getActualCapacity(), report.getActualCapacityUnit()),
                program.getMainImpactSources(),
                emissionSourceRepository.findByProgramIdOrderBySortOrderAscIdAsc(program.getId()).size(),
                dischargeSourceRepository.findByProgramIdOrderBySortOrderAscIdAsc(program.getId()).size(),
                wasteItemRepository.findByProgramIdOrderBySortOrderAscIdAsc(program.getId()).size(),
                report.getPerformedStudies(), monitoring, protocols,
                report.getMonitoringResultsSummary(), planned, completed,
                exceedances, report.getExceedancesSummary(), report.getMeasuresTaken(),
                report.getConclusion(),
                responsible == null ? null : responsible.getName(),
                company == null ? null : company.getDirectorName());
    }

    private PekProgram program(PekReport report) {
        return programRepository.findById(report.getProgramId())
                .orElseThrow(() -> new NotFoundException("Программа ПЭК не найдена"));
    }

    private static String withUnit(String value, String unit) {
        if (blank(value)) return value;
        return blank(unit) ? value : value + " " + unit;
    }

    private static String firstNonBlank(String a, String b) {
        return blank(a) ? b : a;
    }
}
